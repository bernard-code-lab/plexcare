import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxWorker } from '../outbox/outbox.worker';
import { JwksRotatorWorker } from '../crypto/jwks-rotator.worker';
import { PurgerWorker } from '../cleanup/purger.worker';
import { CronLockService } from '../../shared/cron/cron-lock.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CronLockService, OutboxWorker, JwksRotatorWorker, PurgerWorker],
  exports: [OutboxWorker, JwksRotatorWorker, PurgerWorker],
})
export class WorkersModule {}
