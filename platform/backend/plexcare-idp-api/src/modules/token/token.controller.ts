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
import { ExchangeCodeUseCase } from './application/exchange-code.use-case';
import { RefreshTokenUseCase } from './application/refresh-token.use-case';
import { RevokeTokenUseCase } from './application/revoke-token.use-case';
import {
  RefreshDto,
  RevokeDto,
  TokenExchangeDto,
  type RefreshRequest,
  type RevokeRequest,
  type TokenExchangeRequest,
  type TokenResponse,
} from './dto/token.dto';

@Controller({ path: 'v1/token' })
export class TokenController {
  constructor(
    private readonly exchangeUC: ExchangeCodeUseCase,
    private readonly refreshUC: RefreshTokenUseCase,
    private readonly revokeUC: RevokeTokenUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @UsePipes(new ZodValidationPipe(TokenExchangeDto))
  async exchange(@Body() body: TokenExchangeRequest, @Req() req: FastifyRequest): Promise<TokenResponse> {
    return this.exchangeUC.execute(body, {
      ...(req.ip ? { ip: req.ip } : {}),
      ...(req.headers['user-agent'] ? { userAgent: String(req.headers['user-agent']) } : {}),
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
  @UsePipes(new ZodValidationPipe(RefreshDto))
  async refresh(@Body() body: RefreshRequest): Promise<TokenResponse> {
    return this.refreshUC.execute(body);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(RevokeDto))
  async revoke(@Body() body: RevokeRequest): Promise<void> {
    await this.revokeUC.execute(body);
  }
}
