import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AppException } from '../../shared/errors/app-exception';
import { OutboxService } from '../outbox/outbox.service';
import {
  refreshRotationTotal,
  refreshReuseDetectedTotal,
  sessionRevokedTotal,
} from '../../shared/metrics/metrics.registry';

export type RevokeReason =
  | 'logout'
  | 'password_changed'
  | 'admin_revoke'
  | 'reset'
  | 'rotated'
  | 'reuse_detected'
  | 'expired'
  | 'switch';

export interface IssueRefreshInput {
  idpUserId: bigint;
  accountId: bigint;
  clientId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  ttlSeconds: number;
  /** Optional override id (defaults to UUID v4). */
  refreshId?: string;
}

export interface IssueRefreshResult {
  refreshToken: string;
  expiresAt: Date;
}

export interface RotateResult {
  refreshToken: string;
  expiresAt: Date;
  /** Carries forward the previous session's identity. */
  idpUserId: bigint;
  accountId: bigint;
  clientId: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async issueRefresh(input: IssueRefreshInput): Promise<IssueRefreshResult> {
    const id = input.refreshId ?? uuidv4();
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.idpSession.create({
        data: {
          id,
          idpUserId: input.idpUserId,
          accountId: input.accountId,
          clientId: input.clientId,
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null,
          expiresAt,
        },
      });
      await this.outbox.publish(tx, {
        type: 'idp.session.created',
        subject: `idp_user/${input.idpUserId}`,
        tenantId: input.accountId.toString(),
        data: {
          session_id: id,
          idp_user_id: input.idpUserId.toString(),
          account_id: input.accountId.toString(),
          client_id: input.clientId,
          ip_address: input.ipAddress ?? null,
          user_agent: input.userAgent ?? null,
        },
      });
    });
    return { refreshToken: id, expiresAt };
  }

  /**
   * Rotate a refresh token: revoke the presented one, issue a new one with a
   * fresh TTL. If the presented token is already revoked, that is reuse →
   * revoke the entire family (same user + client) and throw.
   *
   * Reuse detection runs in a separate transaction from the main rotation
   * happy path so the side-effect (family revocation + events) actually
   * commits before we throw.
   */
  async rotate(refreshToken: string, ttlSeconds: number): Promise<RotateResult> {
    const session = await this.prisma.idpSession.findUnique({ where: { id: refreshToken } });
    if (!session) {
      throw new AppException('refresh_invalid', { detail: 'refresh token not found' });
    }
    if (session.revokedAt) {
      if (session.revokeReason === 'rotated') {
        // Reuse detected. Revoke family OUTSIDE this code path's transaction.
        await this.revokeFamilyStandalone(session.idpUserId, session.clientId, 'reuse_detected');
        refreshReuseDetectedTotal.inc();
        throw new AppException('refresh_reuse_detected');
      }
      throw new AppException('refresh_invalid', { detail: 'refresh token already revoked' });
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.prisma.idpSession.update({
        where: { id: refreshToken },
        data: { revokedAt: new Date(), revokeReason: 'expired' },
      });
      sessionRevokedTotal.inc({ reason: 'expired' });
      throw new AppException('refresh_invalid', { detail: 'refresh token expired' });
    }

    const newId = uuidv4();
    const newExpiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.$transaction(async (tx) => {
      // Atomic rotation guard: only revoke if still active (race-safe).
      const updated = await tx.idpSession.updateMany({
        where: { id: refreshToken, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'rotated' },
      });
      if (updated.count !== 1) {
        // Lost to a concurrent caller; treat as reuse to be safe.
        throw new AppException('refresh_reuse_detected');
      }
      await tx.idpSession.create({
        data: {
          id: newId,
          idpUserId: session.idpUserId,
          accountId: session.accountId,
          clientId: session.clientId,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          expiresAt: newExpiresAt,
        },
      });
      await this.outbox.publish(tx, {
        type: 'idp.session.created',
        subject: `idp_user/${session.idpUserId}`,
        tenantId: session.accountId.toString(),
        data: {
          session_id: newId,
          idp_user_id: session.idpUserId.toString(),
          account_id: session.accountId.toString(),
          client_id: session.clientId,
        },
      });
    });
    refreshRotationTotal.inc({ client_id: session.clientId });
    return {
      refreshToken: newId,
      expiresAt: newExpiresAt,
      idpUserId: session.idpUserId,
      accountId: session.accountId,
      clientId: session.clientId,
    };
  }

  /** Revoke a single session by id. Idempotent. */
  async revoke(refreshToken: string, reason: RevokeReason): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.idpSession.updateMany({
        where: { id: refreshToken, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: reason },
      });
      if (updated.count === 1) {
        const session = await tx.idpSession.findUnique({ where: { id: refreshToken } });
        if (session) {
          await this.outbox.publish(tx, {
            type: 'idp.session.revoked',
            subject: `idp_user/${session.idpUserId}`,
            tenantId: session.accountId.toString(),
            data: {
              session_id: refreshToken,
              idp_user_id: session.idpUserId.toString(),
              reason,
              revoked_at: new Date().toISOString(),
            },
          });
          sessionRevokedTotal.inc({ reason });
        }
      }
    });
  }

  /** Revoke all active sessions of a user. Used by reset-password etc. */
  async revokeAllForUser(idpUserId: bigint, reason: RevokeReason): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const active = await tx.idpSession.findMany({
        where: { idpUserId, revokedAt: null },
        select: { id: true, accountId: true },
      });
      if (active.length === 0) return 0;
      await tx.idpSession.updateMany({
        where: { idpUserId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: reason },
      });
      for (const s of active) {
        await this.outbox.publish(tx, {
          type: 'idp.session.revoked',
          subject: `idp_user/${idpUserId}`,
          tenantId: s.accountId.toString(),
          data: {
            session_id: s.id,
            idp_user_id: idpUserId.toString(),
            reason,
            revoked_at: new Date().toISOString(),
          },
        });
        sessionRevokedTotal.inc({ reason });
      }
      return active.length;
    });
  }

  private async revokeFamilyStandalone(
    idpUserId: bigint,
    clientId: string,
    reason: RevokeReason,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const active = await tx.idpSession.findMany({
        where: { idpUserId, clientId, revokedAt: null },
        select: { id: true, accountId: true },
      });
      if (active.length === 0) return;
      await tx.idpSession.updateMany({
        where: { idpUserId, clientId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: reason },
      });
      for (const s of active) {
        await this.outbox.publish(tx, {
          type: 'idp.session.revoked',
          subject: `idp_user/${idpUserId}`,
          tenantId: s.accountId.toString(),
          data: {
            session_id: s.id,
            idp_user_id: idpUserId.toString(),
            reason,
            revoked_at: new Date().toISOString(),
          },
        });
        sessionRevokedTotal.inc({ reason });
      }
    });
  }
}
