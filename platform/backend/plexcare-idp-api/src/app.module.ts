import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './shared/prisma/prisma.module';
import { LoggerModule } from './shared/logging/logger.module';
import { MetricsModule } from './shared/metrics/metrics.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { AppExceptionFilter } from './shared/errors/app-exception.filter';

@Module({
  imports: [LoggerModule, ConfigModule, PrismaModule, CryptoModule, MetricsModule],
  controllers: [],
  providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
})
export class AppModule {}
