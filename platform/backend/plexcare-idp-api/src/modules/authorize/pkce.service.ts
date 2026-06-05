import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EnvService } from '../../config/env.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AppException } from '../../shared/errors/app-exception';

export interface CreateStateInput {
  audience: string;
  challenge: string;
  method: 'S256';
  redirectUri: string;
  nonce?: string;
}

export interface CreateStateResult {
  state: string;
  /** Opaque authorization_code returned to the SPA. */
  code: string;
  expiresAt: Date;
}

export interface ConsumedState {
  audience: string;
  redirectUri: string;
  nonce: string;
}

export function generateUrlSafe(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256B64Url(input: string): string {
  return createHash('sha256').update(input).digest('base64url');
}

export function verifyPkceChallenge(verifier: string, challenge: string): boolean {
  return sha256B64Url(verifier) === challenge;
}

@Injectable()
export class PkceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {}

  async createState(input: CreateStateInput): Promise<CreateStateResult> {
    if (input.method !== 'S256') {
      throw new AppException('pkce_state_invalid', { detail: 'Only S256 challenge method is supported' });
    }
    const ttl = this.env.get('PKCE_STATE_TTL_SECONDS');
    const state = generateUrlSafe(24); // 32 chars b64url
    const code = generateUrlSafe(32); // 43 chars b64url
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // Store the **code** as the lookup key (state below is mirrored into the
    // pkce_challenge column for the verifier match; we keep the original state
    // value the SPA passed in so we can echo it back).
    await this.prisma.authorizeState.create({
      data: {
        state: code,
        audience: input.audience,
        pkceChallenge: input.challenge,
        pkceMethod: input.method,
        redirectUri: input.redirectUri,
        nonce: input.nonce ?? '',
        expiresAt,
      },
    });
    return { state, code, expiresAt };
  }

  /**
   * Read the authorize_state row, validate the PKCE verifier, then atomically
   * DELETE it. The DELETE's affected_rows protects against race conditions —
   * if two concurrent consumeState calls see the same row, only one DELETE
   * returns 1 row affected; the other is rejected.
   *
   * Failed validations also delete the row (so a single failed attempt cannot
   * be retried with the correct verifier).
   */
  async consumeState(code: string, codeVerifier: string): Promise<ConsumedState> {
    const row = await this.prisma.authorizeState.findUnique({ where: { state: code } });
    if (!row) {
      throw new AppException('pkce_state_invalid', { detail: 'state not found or already consumed' });
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await this.prisma.authorizeState.deleteMany({ where: { state: code } });
      throw new AppException('pkce_state_invalid', { detail: 'state expired' });
    }
    if (!verifyPkceChallenge(codeVerifier, row.pkceChallenge)) {
      await this.prisma.authorizeState.deleteMany({ where: { state: code } });
      throw new AppException('pkce_verifier_mismatch');
    }
    const deleted = await this.prisma.authorizeState.deleteMany({ where: { state: code } });
    if (deleted.count !== 1) {
      // Lost a concurrent race — another caller already consumed this state.
      throw new AppException('pkce_state_invalid', { detail: 'state consumed by concurrent caller' });
    }
    return {
      audience: row.audience,
      redirectUri: row.redirectUri,
      nonce: row.nonce,
    };
  }
}
