import { Module } from '@nestjs/common';
import { RoleResolverService } from './role-resolver.service';

@Module({
  providers: [RoleResolverService],
  exports: [RoleResolverService],
})
export class RolesModule {}
