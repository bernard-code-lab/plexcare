import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer, type ProducerRecord } from 'kafkajs';
import { EnvService } from '../../config/env.service';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private connected = false;

  constructor(private readonly env: EnvService) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.env.get('KAFKA_BROKERS');
    if (brokers.length === 0) {
      this.logger.warn('KAFKA_BROKERS empty — producer will be inert');
      return;
    }
    this.kafka = new Kafka({
      clientId: this.env.get('KAFKA_CLIENT_ID'),
      brokers,
    });
    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5,
      transactionTimeout: 30_000,
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.producer) {
      throw new Error('KafkaProducerService not initialized (KAFKA_BROKERS empty)');
    }
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
  }

  async produce(record: ProducerRecord): Promise<void> {
    await this.ensureConnected();
    await this.producer!.send({ acks: -1, ...record });
  }

  async produceBatch(records: ProducerRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.ensureConnected();
    await this.producer!.sendBatch({ acks: -1, topicMessages: records });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer && this.connected) {
      await this.producer.disconnect();
    }
  }
}
