import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, type AxiosInstance } from 'axios';
import { decodeJwt } from 'jose';
import { EnvService } from '../../config/env.service';
import { AppException } from '../../shared/errors/app-exception';
import { KeycloakAdminTokenService } from './keycloak-admin-token.service';
import { kcRequestDurationSeconds } from '../../shared/metrics/metrics.registry';

export interface DirectGrantResult {
  kcAccessToken: string;
  kcRefreshToken: string;
  kcUserId: string;
  email: string;
  emailVerified: boolean;
  expiresIn: number;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  emailVerified?: boolean;
}

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);
  private readonly http: AxiosInstance;

  constructor(
    private readonly env: EnvService,
    private readonly adminTokens: KeycloakAdminTokenService,
  ) {
    this.http = axios.create({
      baseURL: env.get('KEYCLOAK_BASE_URL').replace(/\/$/, ''),
      timeout: 5000,
    });
  }

  private realm(): string {
    return this.env.get('KEYCLOAK_REALM');
  }

  /** Validate user credentials via OIDC Direct Grant. */
  async directGrant(email: string, password: string): Promise<DirectGrantResult> {
    const timer = kcRequestDurationSeconds.startTimer({ endpoint: 'token' });
    try {
      const body = new URLSearchParams({
        grant_type: 'password',
        client_id: 'plexcare-direct',
        username: email,
        password, // header redaction in pino covers our own logs; axios body isn't logged.
        scope: 'openid email profile',
      });
      const resp = await this.http.post<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
      }>(
        `/realms/${this.realm()}/protocol/openid-connect/token`,
        body.toString(),
        { headers: { 'content-type': 'application/x-www-form-urlencoded' } },
      );
      timer({ endpoint: 'token' });
      const claims = decodeJwt(resp.data.access_token);
      return {
        kcAccessToken: resp.data.access_token,
        kcRefreshToken: resp.data.refresh_token,
        kcUserId: typeof claims.sub === 'string' ? claims.sub : '',
        email: typeof claims.email === 'string' ? claims.email : email,
        emailVerified: Boolean(claims.email_verified),
        expiresIn: resp.data.expires_in,
      };
    } catch (e) {
      timer({ endpoint: 'token' });
      const err = e as AxiosError;
      const status = err.response?.status ?? 0;
      if (status === 401 || status === 400) {
        throw new AppException('login_invalid_credentials', { cause: e });
      }
      if (status >= 500 || status === 0) {
        throw new AppException('service_unavailable', {
          detail: 'Keycloak token endpoint failure',
          cause: e,
        });
      }
      throw new AppException('login_invalid_credentials', { cause: e });
    }
  }

  /** Create a user in Keycloak via Admin API. Returns the new user id. */
  async createUser(input: CreateUserInput): Promise<string> {
    const token = await this.adminTokens.get(this.http);
    const timer = kcRequestDurationSeconds.startTimer({ endpoint: 'admin_users' });
    try {
      const [first, ...rest] = input.fullName.trim().split(/\s+/);
      const resp = await this.http.post(
        `/admin/realms/${this.realm()}/users`,
        {
          username: input.email,
          email: input.email,
          firstName: first ?? input.email,
          lastName: rest.join(' ') || '-',
          emailVerified: input.emailVerified ?? false,
          enabled: true,
          credentials: [{ type: 'password', value: input.password, temporary: false }],
        },
        { headers: { authorization: `Bearer ${token}` }, validateStatus: () => true },
      );
      timer({ endpoint: 'admin_users' });
      if (resp.status === 409) {
        throw new AppException('signup_email_taken');
      }
      if (resp.status !== 201) {
        throw new AppException('service_unavailable', {
          detail: `Keycloak createUser returned ${resp.status}`,
          cause: resp.data,
        });
      }
      const location = (resp.headers?.['location'] ?? resp.headers?.['Location']) as string | undefined;
      if (!location) {
        throw new AppException('service_unavailable', { detail: 'KC createUser missing Location header' });
      }
      return location.split('/').pop() ?? '';
    } catch (e) {
      if (e instanceof AppException) throw e;
      timer({ endpoint: 'admin_users' });
      throw new AppException('service_unavailable', { cause: e });
    }
  }

  /** Trigger an action email (VERIFY_EMAIL or UPDATE_PASSWORD). */
  async executeActionsEmail(
    kcUserId: string,
    actions: Array<'VERIFY_EMAIL' | 'UPDATE_PASSWORD'>,
    redirectUri?: string,
  ): Promise<void> {
    const token = await this.adminTokens.get(this.http);
    const timer = kcRequestDurationSeconds.startTimer({ endpoint: 'admin_email' });
    try {
      const params = redirectUri ? { redirect_uri: redirectUri, client_id: 'plexcare-login-web' } : {};
      const resp = await this.http.put(
        `/admin/realms/${this.realm()}/users/${kcUserId}/execute-actions-email`,
        actions,
        {
          headers: { authorization: `Bearer ${token}` },
          params,
          validateStatus: () => true,
        },
      );
      timer({ endpoint: 'admin_email' });
      if (resp.status !== 204) {
        throw new AppException('service_unavailable', {
          detail: `Keycloak executeActionsEmail returned ${resp.status}`,
        });
      }
    } catch (e) {
      if (e instanceof AppException) throw e;
      timer({ endpoint: 'admin_email' });
      throw new AppException('service_unavailable', { cause: e });
    }
  }

  /** Reset password to a new value (admin operation, no current-password check). */
  async resetPassword(kcUserId: string, newPassword: string): Promise<void> {
    const token = await this.adminTokens.get(this.http);
    const resp = await this.http.put(
      `/admin/realms/${this.realm()}/users/${kcUserId}/reset-password`,
      { type: 'password', value: newPassword, temporary: false },
      { headers: { authorization: `Bearer ${token}` }, validateStatus: () => true },
    );
    if (resp.status !== 204) {
      throw new AppException('service_unavailable', {
        detail: `Keycloak resetPassword returned ${resp.status}`,
      });
    }
  }

  /** Health probe used by /ready. */
  async ping(): Promise<boolean> {
    try {
      await this.http.get(`/realms/${this.realm()}`, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}
