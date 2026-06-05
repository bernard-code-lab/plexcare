import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UsePipes,
  UseInterceptors,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ZodValidationPipe } from '../../shared/auth/zod-validation.pipe';
import { IdempotencyInterceptor } from '../../shared/auth/idempotency.interceptor';
import { SignupDto, type SignupRequest } from './dto/signup.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
  type VerifyEmailRequest,
} from './dto/password.dto';
import { SignupUseCase } from './application/signup.use-case';
import { ForgotPasswordUseCase } from './application/forgot-password.use-case';
import { ResetPasswordUseCase } from './application/reset-password.use-case';
import { VerifyEmailUseCase } from './application/verify-email.use-case';

@Controller({ path: 'v1/auth' })
export class AuthController {
  constructor(
    private readonly signupUC: SignupUseCase,
    private readonly forgotUC: ForgotPasswordUseCase,
    private readonly resetUC: ResetPasswordUseCase,
    private readonly verifyEmailUC: VerifyEmailUseCase,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(IdempotencyInterceptor)
  @UsePipes(new ZodValidationPipe(SignupDto))
  async signup(@Body() body: SignupRequest, @Req() req: FastifyRequest) {
    return this.signupUC.execute(body, req.ip);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(ForgotPasswordDto))
  async forgotPassword(@Body() body: ForgotPasswordRequest): Promise<void> {
    await this.forgotUC.execute(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(ResetPasswordDto))
  async resetPassword(@Body() body: ResetPasswordRequest): Promise<void> {
    await this.resetUC.execute(body.reset_token, body.new_password);
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(VerifyEmailDto))
  async verifyEmail(@Body() body: VerifyEmailRequest) {
    return this.verifyEmailUC.execute(body.verification_token);
  }
}
