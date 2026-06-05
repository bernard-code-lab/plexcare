import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { PrismaClient } from '@prisma/client';
import { SessionService } from '../../src/modules/sessions/session.service';
import { OutboxService } from '../../src/modules/outbox/outbox.service';
import { describeIfDocker } from './_docker';

describeIfDocker('SessionService (integration)', () => {
  let container: StartedMySqlContainer;
  let prisma: PrismaClient;
  let svc: SessionService;
  let outbox: OutboxService;

  const idpUserId = 1n;
  const accountId = 2n;
  const clientId = 'plexcare-platform-web';

  beforeAll(async () => {
    container = await new MySqlContainer('mysql:8.0')
      .withDatabase('db')
      .withUsername('plexcare')
      .withUserPassword('plexcare')
      .withRootPassword('rootpass')
      .start();

    const url = `mysql://plexcare:plexcare@${container.getHost()}:${container.getPort()}/db`;
    prisma = new PrismaClient({ datasourceUrl: url });
    await prisma.$connect();

    // Bare-bones schema for sessions + outbox (FKs intentionally omitted to
    // keep the test focused on the service logic).
    await prisma.$executeRawUnsafe(`
      CREATE TABLE idp_session (
        id CHAR(36) NOT NULL PRIMARY KEY,
        idp_user_id BIGINT UNSIGNED NOT NULL,
        account_id BIGINT UNSIGNED NOT NULL,
        client_id VARCHAR(64) NOT NULL,
        user_agent VARCHAR(512) NULL,
        ip_address VARCHAR(64) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        last_used_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        expires_at DATETIME(3) NOT NULL,
        revoked_at DATETIME(3) NULL,
        revoke_reason VARCHAR(64) NULL
      ) ENGINE=InnoDB
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE outbox (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        event_id CHAR(36) NOT NULL UNIQUE,
        type VARCHAR(128) NOT NULL,
        payload JSON NOT NULL,
        occurred_at DATETIME(3) NOT NULL,
        enqueued_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        published_at DATETIME(3) NULL,
        attempts INT UNSIGNED NOT NULL DEFAULT 0,
        last_error TEXT NULL
      ) ENGINE=InnoDB
    `);

    outbox = new OutboxService(prisma as never);
    svc = new SessionService(prisma as never, outbox);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('DELETE FROM idp_session');
    await prisma.$executeRawUnsafe('DELETE FROM outbox');
  });

  async function issue() {
    return svc.issueRefresh({ idpUserId, accountId, clientId, ttlSeconds: 60 });
  }

  it('issueRefresh inserts session + outbox idp.session.created', async () => {
    const { refreshToken } = await issue();
    expect(refreshToken).toMatch(/^[0-9a-f-]{36}$/);
    const row = await prisma.idpSession.findUnique({ where: { id: refreshToken } });
    expect(row).not.toBeNull();
    const events = await prisma.outbox.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('idp.session.created');
  });

  it('rotate revokes the old refresh and issues a new one', async () => {
    const r1 = await issue();
    const r2 = await svc.rotate(r1.refreshToken, 60);
    expect(r2.refreshToken).not.toBe(r1.refreshToken);
    const old = await prisma.idpSession.findUnique({ where: { id: r1.refreshToken } });
    expect(old?.revokedAt).not.toBeNull();
    expect(old?.revokeReason).toBe('rotated');
  });

  it('rotate twice with original (reuse) revokes the entire family and throws', async () => {
    const r1 = await issue();
    const r2 = await svc.rotate(r1.refreshToken, 60);
    await expect(svc.rotate(r1.refreshToken, 60)).rejects.toMatchObject({
      code: 'refresh_reuse_detected',
    });
    const r2row = await prisma.idpSession.findUnique({ where: { id: r2.refreshToken } });
    expect(r2row?.revokedAt).not.toBeNull();
    expect(r2row?.revokeReason).toBe('reuse_detected');
  });

  it('rotate of an expired refresh throws refresh_invalid', async () => {
    const id = (await issue()).refreshToken;
    await prisma.idpSession.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(svc.rotate(id, 60)).rejects.toMatchObject({ code: 'refresh_invalid' });
  });

  it('revoke is idempotent and publishes idp.session.revoked once', async () => {
    const { refreshToken } = await issue();
    await svc.revoke(refreshToken, 'logout');
    await svc.revoke(refreshToken, 'logout');
    const revoked = await prisma.outbox.findMany({ where: { type: 'idp.session.revoked' } });
    expect(revoked).toHaveLength(1);
  });

  it('revokeAllForUser revokes N sessions and emits N events', async () => {
    await issue();
    await issue();
    await issue();
    const n = await svc.revokeAllForUser(idpUserId, 'reset');
    expect(n).toBe(3);
    const revoked = await prisma.outbox.findMany({ where: { type: 'idp.session.revoked' } });
    expect(revoked).toHaveLength(3);
  });
});
