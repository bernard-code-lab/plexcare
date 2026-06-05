import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { EnvService } from './env.service';
import { zodValidate } from './env.schema';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: zodValidate,
    }),
  ],
  providers: [EnvService],
  exports: [EnvService],
})
export class ConfigModule {}
