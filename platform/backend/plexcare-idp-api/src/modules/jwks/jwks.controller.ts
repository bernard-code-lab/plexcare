import { Controller, Get, Header } from '@nestjs/common';
import { KeyLoaderService } from '../../shared/crypto/key-loader.service';
import { EnvService } from '../../config/env.service';

@Controller()
export class JwksController {
  constructor(
    private readonly keyLoader: KeyLoaderService,
    private readonly env: EnvService,
  ) {}

  @Get('.well-known/jwks.json')
  @Header('cache-control', 'public, max-age=600')
  async jwks(): Promise<{ keys: unknown[] }> {
    return this.keyLoader.getJwks();
  }

  @Get('.well-known/openid-configuration')
  oidcConfig(): Record<string, unknown> {
    const issuer = this.env.get('ISSUER_URL');
    return {
      issuer,
      authorization_endpoint: `${issuer}/v1/auth/login`,
      token_endpoint: `${issuer}/v1/token`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      userinfo_endpoint: `${issuer}/v1/me`,
      revocation_endpoint: `${issuer}/v1/token/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      id_token_signing_alg_values_supported: ['EdDSA'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['openid', 'profile', 'email'],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'email',
        'email_verified',
        'account_id',
        'roles',
        'active_role',
        'doctor_id',
      ],
    };
  }
}
