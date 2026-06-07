import { Injectable } from '@nestjs/common';
import { decodeProtectedHeader, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { EnvService } from '../../config/env.service';
import { AppException } from '../errors/app-exception';
import { KeyLoaderService } from './key-loader.service';

export const ALG = 'EdDSA' as const;

export interface IdpClaims {
  sub: string;
  client_id: string;
  account_id?: string;
  account_customer_id?: string;
  /**
   * UUID externo do tenant — alias estável (não-numérico) do account_id.
   * Consumido pelos serviços downstream como identificador canônico
   * (ADR-0011 §D-1, Issue #3).
   */
  tenant_id?: string;
  active_role?: string;
  roles?: string[];
  doctor_id?: string | null;
  client_id_party?: string | null;
  employee_id?: string | null;
  email?: string;
  email_verified?: boolean;
  locale?: string;
  /** Audience for this token (typically the client_id). */
  audience: string;
}

export interface SignedToken {
  token: string;
  kid: string;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtSignerService {
  constructor(
    private readonly keyLoader: KeyLoaderService,
    private readonly env: EnvService,
  ) {}

  async sign(claims: IdpClaims, ttlSeconds: number): Promise<SignedToken> {
    const active = await this.keyLoader.loadActive();
    const privateKey = await this.keyLoader.getPrivateKey(active);

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + ttlSeconds;
    const jti = uuidv4();
    const issuer = this.env.get('ISSUER_URL');

    const { audience, sub, ...rest } = claims;

    const jwt = await new SignJWT(rest as JWTPayload)
      .setProtectedHeader({ alg: ALG, typ: 'JWT', kid: active.kid })
      .setIssuer(issuer)
      .setSubject(sub)
      .setAudience(audience)
      .setIssuedAt(iat)
      .setNotBefore(iat)
      .setExpirationTime(exp)
      .setJti(jti)
      .sign(privateKey);

    return { token: jwt, kid: active.kid, jti, iat, exp };
  }

  /**
   * Verify a JWT. When `expectedAudience` is provided, the token is rejected
   * unless its `aud` claim matches one of the provided values. Callers serving
   * authenticated requests MUST pass the set of valid audiences (typically the
   * registered `idp_client` list) to prevent cross-client token reuse.
   */
  async verify(
    jwt: string,
    expectedAudience?: string | string[],
  ): Promise<JWTPayload & { kid: string }> {
    let header: ReturnType<typeof decodeProtectedHeader>;
    try {
      header = decodeProtectedHeader(jwt);
    } catch {
      throw new AppException('token_invalid', { detail: 'Malformed JWT header' });
    }

    if (header.alg !== ALG) {
      throw new AppException('token_invalid', {
        detail: `Algorithm ${header.alg} not allowed (only ${ALG})`,
      });
    }
    if (!header.kid || typeof header.kid !== 'string') {
      throw new AppException('token_invalid', { detail: 'Missing kid in JWT header' });
    }

    const resolved = await this.keyLoader.getPublicKey(header.kid);
    if (!resolved) {
      throw new AppException('token_invalid', { detail: `Unknown kid ${header.kid}` });
    }

    try {
      const { payload } = await jwtVerify(jwt, resolved.key, {
        algorithms: [ALG],
        issuer: this.env.get('ISSUER_URL'),
        ...(expectedAudience !== undefined ? { audience: expectedAudience } : {}),
      });
      return { ...payload, kid: header.kid };
    } catch (err) {
      throw new AppException('token_invalid', {
        detail: `Signature/claims verification failed: ${(err as Error).message}`,
        cause: err,
      });
    }
  }
}
