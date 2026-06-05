import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { RolesModule } from '../roles/roles.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';

@Module({
  imports: [RolesModule, SessionsModule, AuthModule],
  controllers: [MeController],
  providers: [JwtAuthGuard],
})
export class MeModule {}
