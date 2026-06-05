import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { buildCloudEvent, CloudEventInput, IdpEventType } from './cloudevents';

type PrismaTx = Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Insert a CloudEvent into the outbox in the same transaction as the
   * business write. Pass `tx` (PrismaTransactionClient) so atomicity holds.
   * Returns the persisted event_id.
   */
  async publish<T>(tx: PrismaTx, input: CloudEventInput<T>): Promise<string> {
    const envelope = buildCloudEvent(input);
    await tx.outbox.create({
      data: {
        eventId: envelope.id,
        type: envelope.type,
        payload: envelope as unknown as Prisma.InputJsonValue,
        occurredAt: new Date(envelope.time),
      },
    });
    return envelope.id;
  }

  /** Same as publish() but uses the root PrismaClient (no surrounding TX). */
  async publishStandalone<T>(input: CloudEventInput<T>): Promise<string> {
    return this.publish(this.prisma, input);
  }
}

export type { IdpEventType };
