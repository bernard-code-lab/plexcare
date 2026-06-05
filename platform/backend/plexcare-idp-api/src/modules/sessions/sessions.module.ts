import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { SessionService } from './session.service';

@Module({
  imports: [OutboxModule],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionsModule {}
