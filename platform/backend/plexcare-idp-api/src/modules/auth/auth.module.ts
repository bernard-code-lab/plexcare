import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SignupUseCase } from './application/signup.use-case';
import { ForgotPasswordUseCase } from './application/forgot-password.use-case';
import { ResetPasswordUseCase } from './application/reset-password.use-case';
import { ChangePasswordUseCase } from './application/change-password.use-case';
import { VerifyEmailUseCase } from './application/verify-email.use-case';
import { AuthController } from './auth.controller';

@Module({
  imports: [OutboxModule, SessionsModule],
  controllers: [AuthController],
  providers: [
    SignupUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
    VerifyEmailUseCase,
  ],
  exports: [SignupUseCase, ChangePasswordUseCase],
})
export class AuthModule {}
