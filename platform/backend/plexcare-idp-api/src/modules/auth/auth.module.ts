import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { SignupUseCase } from './application/signup.use-case';
import { AuthController } from './auth.controller';

@Module({
  imports: [OutboxModule],
  controllers: [AuthController],
  providers: [SignupUseCase],
  exports: [SignupUseCase],
})
export class AuthModule {}
