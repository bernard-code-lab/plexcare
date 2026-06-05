import { Module } from '@nestjs/common';
import { PkceService } from './pkce.service';
import { LoginUseCase } from './application/login.use-case';
import { AuthorizeController } from './authorize.controller';
import { LockoutModule } from '../lockout/lockout.module';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [LockoutModule, OutboxModule],
  controllers: [AuthorizeController],
  providers: [PkceService, LoginUseCase],
  exports: [PkceService],
})
export class AuthorizeModule {}
