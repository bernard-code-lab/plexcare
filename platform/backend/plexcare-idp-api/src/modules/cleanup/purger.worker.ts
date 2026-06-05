import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CronLockService } from '../../shared/cron/cron-lock.service';

const SESSION_RETAIN_DAYS = 30;

@Injectable()
export class PurgerWorker {
  private readonly logger = new Logger(PurgerWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lock: CronLockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduled(): Promise<void> {
    if (process.env.IDP_DISABLE_WORKERS === 'true') return;
    await this.lock.withLock('purger', 50, async () => {
      await this.purge();
    });
  }

  async purge(): Promise<{ states: number; sessions: number; idempotency: number }> {
    const now = new Date();
    const sessionCutoff = new Date(now.getTime() - SESSION_RETAIN_DAYS * 24 * 60 * 60 * 1000);

    const [states, sessions, idempotency] = await Promise.all([
      this.prisma.authorizeState.deleteMany({ where: { expiresAt: { lt: now } } }),
      this.prisma.idpSession.deleteMany({ where: { revokedAt: { not: null, lt: sessionCutoff } } }),
      this.prisma.idpIdempotency.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);
    if (states.count + sessions.count + idempotency.count > 0) {
      this.logger.debug(
        `purger removed states=${states.count} sessions=${sessions.count} idem=${idempotency.count}`,
      );
    }
    return { states: states.count, sessions: sessions.count, idempotency: idempotency.count };
  }
}
