import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { KafkaProducerService } from '../../shared/kafka/kafka-producer.service';
import { TOPIC_BY_TYPE, type IdpEventType } from './cloudevents';
import { outboxLagSeconds, outboxPending } from '../../shared/metrics/metrics.registry';

const TICK_INTERVAL_MS = 500;
const BATCH_SIZE = 100;

interface OutboxRow {
  id: bigint;
  event_id: string;
  type: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
  attempts: number;
}

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
  ) {}

  onModuleInit(): void {
    if (process.env.IDP_DISABLE_WORKERS === 'true') return;
    this.timer = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Exposed for tests. Picks pending rows, sends to Kafka, marks published. */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const rows = await this.prisma.$queryRawUnsafe<OutboxRow[]>(
        `SELECT id, event_id, type, payload, occurred_at, attempts FROM outbox
         WHERE published_at IS NULL ORDER BY id LIMIT ${BATCH_SIZE} FOR UPDATE SKIP LOCKED`,
      );
      if (rows.length === 0) {
        await this.updateLagMetrics();
        return 0;
      }
      try {
        const batched = this.groupByTopic(rows);
        await this.kafka.produceBatch(batched);
        const ids = rows.map((r) => r.id);
        await this.prisma.outbox.updateMany({
          where: { id: { in: ids } },
          data: { publishedAt: new Date() },
        });
      } catch (e) {
        const ids = rows.map((r) => r.id);
        await this.prisma.outbox.updateMany({
          where: { id: { in: ids } },
          data: { attempts: { increment: 1 }, lastError: (e as Error).message.slice(0, 1000) },
        });
        this.logger.warn(`outbox publish failed for ${rows.length} rows: ${(e as Error).message}`);
      }
      await this.updateLagMetrics();
      return rows.length;
    } finally {
      this.running = false;
    }
  }

  private groupByTopic(rows: OutboxRow[]) {
    const map = new Map<string, Array<{ key: string; value: string }>>();
    for (const r of rows) {
      const topic = TOPIC_BY_TYPE[r.type as IdpEventType];
      if (!topic) continue;
      const subject = String((r.payload as { subject?: string }).subject ?? '');
      const key = subject.split('/').pop() ?? r.event_id;
      const list = map.get(topic) ?? [];
      list.push({ key, value: JSON.stringify(r.payload) });
      map.set(topic, list);
    }
    return Array.from(map.entries()).map(([topic, messages]) => ({ topic, messages }));
  }

  private async updateLagMetrics(): Promise<void> {
    const pending = await this.prisma.outbox.count({ where: { publishedAt: null } });
    outboxPending.set(pending);
    if (pending === 0) {
      outboxLagSeconds.set(0);
      return;
    }
    const oldest = await this.prisma.outbox.findFirst({
      where: { publishedAt: null },
      orderBy: { occurredAt: 'asc' },
      select: { occurredAt: true },
    });
    const lag = oldest ? (Date.now() - oldest.occurredAt.getTime()) / 1000 : 0;
    outboxLagSeconds.set(lag);
  }
}
