import { Body, Controller, HttpCode, HttpStatus, Post, Req, UsePipes } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ZodValidationPipe } from '../../shared/auth/zod-validation.pipe';
import { LoginDto, type LoginRequest } from './dto/login.dto';
import { LoginUseCase } from './application/login.use-case';

@Controller({ path: 'v1/auth' })
export class AuthorizeController {
  constructor(private readonly loginUC: LoginUseCase) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginDto))
  async login(@Body() body: LoginRequest, @Req() req: FastifyRequest) {
    return this.loginUC.execute(body, req.ip);
  }
}
