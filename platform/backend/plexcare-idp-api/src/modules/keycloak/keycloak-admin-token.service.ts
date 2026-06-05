import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';
import { EnvService } from '../../config/env.service';
import { AppException } from '../../shared/errors/app-exception';

interface CachedToken {
  token: string;
  /** Epoch seconds when this token expires. */
  expiresAt: number;
}

@Injectable()
export class KeycloakAdminTokenService {
  private readonly logger = new Logger(KeycloakAdminTokenService.name);
  private cached: CachedToken | null = null;

  constructor(private readonly env: EnvService) {}

  async get(http: AxiosInstance = axios.create()): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cached && this.cached.expiresAt - 60 > now) {
      return this.cached.token;
    }
    const realm = this.env.get('KEYCLOAK_REALM');
    const base = this.env.get('KEYCLOAK_BASE_URL').replace(/\/$/, '');
    const url = `${base}/realms/${realm}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.env.get('KEYCLOAK_ADMIN_CLIENT_ID'),
      client_secret: this.env.get('KEYCLOAK_ADMIN_CLIENT_SECRET'),
    });
    try {
      const resp = await http.post<{ access_token: string; expires_in: number }>(url, body.toString(), {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
      });
      this.cached = {
        token: resp.data.access_token,
        expiresAt: now + (resp.data.expires_in ?? 60),
      };
      return this.cached.token;
    } catch (e) {
      this.logger.error(`KC admin token fetch failed: ${(e as Error).message}`);
      throw new AppException('service_unavailable', {
        detail: 'Keycloak admin token endpoint unreachable',
        cause: e,
      });
    }
  }

  /** Test hook — drop cached token. */
  reset(): void {
    this.cached = null;
  }
}
