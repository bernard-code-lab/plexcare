import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { LockoutService } from '../../lockout/lockout.service';
import { KeycloakService } from '../../keycloak/keycloak.service';
import { OutboxService } from '../../outbox/outbox.service';
import { PkceService } from '../pkce.service';
import { AppException } from '../../../shared/errors/app-exception';
import { loginTotal } from '../../../shared/metrics/metrics.registry';
import { createHash } from 'node:crypto';
import type { LoginRequest } from '../dto/login.dto';

export interface LoginResult {
  code: string;
  state: string;
  redirect_uri: string;
}

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lockout: LockoutService,
    private readonly kc: KeycloakService,
    private readonly pkce: PkceService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(input: LoginRequest, ip: string | undefined): Promise<LoginResult> {
    const ipKey = `ip:${ip ?? 'unknown'}`;
    const emailKey = `email:${input.email.toLowerCase()}`;

    // 1) Lockout check (skip Keycloak if blocked).
    const lockoutCheck = await this.lockout.check(emailKey);
    if (lockoutCheck.blocked) {
      loginTotal.inc({ result: 'locked' });
      throw new AppException('login_locked', {
        extra: { retry_after_seconds: Math.ceil((lockoutCheck.until!.getTime() - Date.now()) / 1000) },
      });
    }

    // 2) Validate the client_id + redirect_uri whitelist.
    const client = await this.prisma.idpClient.findUnique({ where: { clientId: input.client_id } });
    if (!client) {
      throw new AppException('pkce_state_invalid', { detail: 'Unknown client_id' });
    }
    const allowed = Array.isArray(client.redirectUris) ? client.redirectUris as string[] : [];
    if (!allowed.includes(input.redirect_uri)) {
      throw new AppException('pkce_state_invalid', { detail: 'redirect_uri not allowed for client_id' });
    }

    // 3) Validate password against KC.
    try {
      const grant = await this.kc.directGrant(input.email, input.password);
      if (!grant.emailVerified) {
        loginTotal.inc({ result: 'email_not_verified' });
        throw new AppException('login_email_not_verified');
      }
    } catch (e) {
      if (e instanceof AppException) {
        if (e.code === 'login_invalid_credentials') {
          await this.lockout.registerFailure(emailKey);
          await this.lockout.registerFailure(ipKey);
          await this.outbox.publishStandalone({
            type: 'idp.session.login_failed',
            subject: 'idp_user/unknown',
            data: {
              email_hash: createHash('sha256').update(input.email.toLowerCase()).digest('hex').slice(0, 16),
              ip_address: ip ?? null,
              reason: 'bad_credentials',
              occurred_at: new Date().toISOString(),
            },
          });
          loginTotal.inc({ result: 'failure' });
        } else if (e.code === 'service_unavailable') {
          loginTotal.inc({ result: 'kc_down' });
        }
        throw e;
      }
      throw e;
    }

    // 4) Success — reset lockout + emit PKCE state + code.
    await this.lockout.reset(emailKey);
    const created = await this.pkce.createState({
      audience: client.audience,
      challenge: input.code_challenge,
      method: 'S256',
      redirectUri: input.redirect_uri,
      nonce: input.nonce ?? '',
    });
    loginTotal.inc({ result: 'success' });
    return { code: created.code, state: input.state, redirect_uri: input.redirect_uri };
  }
}
