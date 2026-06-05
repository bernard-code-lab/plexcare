import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { PrismaClient } from '@prisma/client';
import {
  PkceService,
  generateUrlSafe,
  sha256B64Url,
} from '../../src/modules/authorize/pkce.service';
import { describeIfDocker } from './_docker';

const env = {
  get(key: string): number {
    if (key === 'PKCE_STATE_TTL_SECONDS') return 300;
    return 0;
  },
} as never;

describeIfDocker('PkceService (integration)', () => {
  let container: StartedMySqlContainer;
  let prisma: PrismaClient;
  let svc: PkceService;

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
    await prisma.$executeRawUnsafe(`
      CREATE TABLE authorize_state (
        state VARCHAR(96) NOT NULL PRIMARY KEY,
        audience VARCHAR(64) NOT NULL,
        pkce_challenge VARCHAR(128) NOT NULL,
        pkce_method VARCHAR(8) NOT NULL,
        redirect_uri VARCHAR(2048) NOT NULL,
        nonce VARCHAR(96) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        expires_at DATETIME(3) NOT NULL,
        KEY idx_authorize_state_expires (expires_at)
      ) ENGINE=InnoDB
    `);
    svc = new PkceService(prisma as never, env);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('DELETE FROM authorize_state');
  });

  it('createState inserts a row and returns state + code', async () => {
    const verifier = generateUrlSafe(48);
    const challenge = sha256B64Url(verifier);
    const out = await svc.createState({
      audience: 'plexcare-platform-web',
      challenge,
      method: 'S256',
      redirectUri: 'http://localhost:5176/callback',
      nonce: 'n-1',
    });
    expect(out.state.length).toBeGreaterThanOrEqual(32);
    expect(out.code.length).toBeGreaterThanOrEqual(43);
    expect(out.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const row = await prisma.authorizeState.findUnique({ where: { state: out.code } });
    expect(row).not.toBeNull();
  });

  it('consumeState happy path returns audience/redirectUri/nonce and deletes the row', async () => {
    const verifier = generateUrlSafe(48);
    const challenge = sha256B64Url(verifier);
    const { code } = await svc.createState({
      audience: 'plexcare-platform-web',
      challenge,
      method: 'S256',
      redirectUri: 'http://localhost:5176/callback',
      nonce: 'n-x',
    });
    const consumed = await svc.consumeState(code, verifier);
    expect(consumed).toMatchObject({
      audience: 'plexcare-platform-web',
      redirectUri: 'http://localhost:5176/callback',
      nonce: 'n-x',
    });
    const row = await prisma.authorizeState.findUnique({ where: { state: code } });
    expect(row).toBeNull();
  });

  it('consumeState rejects unknown code → pkce_state_invalid', async () => {
    await expect(svc.consumeState('nope', 'whatever')).rejects.toMatchObject({
      code: 'pkce_state_invalid',
    });
  });

  it('consumeState rejects mismatched verifier → pkce_verifier_mismatch', async () => {
    const verifier = generateUrlSafe(48);
    const { code } = await svc.createState({
      audience: 'a',
      challenge: sha256B64Url(verifier),
      method: 'S256',
      redirectUri: 'http://localhost',
    });
    await expect(svc.consumeState(code, 'wrong-verifier')).rejects.toMatchObject({
      code: 'pkce_verifier_mismatch',
    });
    // Row should be deleted to avoid retries.
    expect(await prisma.authorizeState.findUnique({ where: { state: code } })).toBeNull();
  });

  it('consumeState rejects expired state', async () => {
    const verifier = generateUrlSafe(48);
    const challenge = sha256B64Url(verifier);
    const code = generateUrlSafe(32);
    await prisma.authorizeState.create({
      data: {
        state: code,
        audience: 'a',
        pkceChallenge: challenge,
        pkceMethod: 'S256',
        redirectUri: 'http://localhost',
        nonce: '',
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await expect(svc.consumeState(code, verifier)).rejects.toMatchObject({
      code: 'pkce_state_invalid',
    });
  });

  it('concurrent consumeState — exactly one succeeds', async () => {
    const verifier = generateUrlSafe(48);
    const { code } = await svc.createState({
      audience: 'a',
      challenge: sha256B64Url(verifier),
      method: 'S256',
      redirectUri: 'http://localhost',
    });
    const results = await Promise.allSettled([
      svc.consumeState(code, verifier),
      svc.consumeState(code, verifier),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'pkce_state_invalid' });
  });
});
