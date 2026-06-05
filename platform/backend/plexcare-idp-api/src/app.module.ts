import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { LoggerModule } from './shared/logging/logger.module';
import { MetricsModule } from './shared/metrics/metrics.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { KafkaModule } from './shared/kafka/kafka.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { KeycloakModule } from './modules/keycloak/keycloak.module';
import { LockoutModule } from './modules/lockout/lockout.module';
import { AuthorizeModule } from './modules/authorize/authorize.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { RolesModule } from './modules/roles/roles.module';
import { JwksModule } from './modules/jwks/jwks.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TokenModule } from './modules/token/token.module';
import { MeModule } from './modules/me/me.module';
import { AppExceptionFilter } from './shared/errors/app-exception.filter';

@Module({
  imports: [
    LoggerModule,
    ConfigModule,
    PrismaModule,
    CryptoModule,
    KafkaModule,
    KeycloakModule,
    OutboxModule,
    LockoutModule,
    AuthorizeModule,
    SessionsModule,
    RolesModule,
    JwksModule,
    HealthModule,
    AuthModule,
    TokenModule,
    MeModule,
    MetricsModule,
  ],
  controllers: [],
  providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
})
export class AppModule {}
