import { Module } from '@nestjs/common';
import { TokenController } from './token.controller';
import { ExchangeCodeUseCase } from './application/exchange-code.use-case';
import { RefreshTokenUseCase } from './application/refresh-token.use-case';
import { RevokeTokenUseCase } from './application/revoke-token.use-case';
import { AuthorizeModule } from '../authorize/authorize.module';
import { SessionsModule } from '../sessions/sessions.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [AuthorizeModule, SessionsModule, RolesModule],
  controllers: [TokenController],
  providers: [ExchangeCodeUseCase, RefreshTokenUseCase, RevokeTokenUseCase],
})
export class TokenModule {}
