import { Global, Module } from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { KeycloakAdminTokenService } from './keycloak-admin-token.service';

@Global()
@Module({
  providers: [KeycloakService, KeycloakAdminTokenService],
  exports: [KeycloakService, KeycloakAdminTokenService],
})
export class KeycloakModule {}
