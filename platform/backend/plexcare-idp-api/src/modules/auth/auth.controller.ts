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
import { SignupUseCase } from './application/signup.use-case';

@Controller({ path: 'v1/auth' })
export class AuthController {
  constructor(private readonly signupUC: SignupUseCase) {}

  @Post('signup')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(IdempotencyInterceptor)
  @UsePipes(new ZodValidationPipe(SignupDto))
  async signup(@Body() body: SignupRequest, @Req() req: FastifyRequest) {
    return this.signupUC.execute(body, req.ip);
  }
}
