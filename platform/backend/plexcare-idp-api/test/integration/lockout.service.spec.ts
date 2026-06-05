import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { PrismaClient } from '@prisma/client';
import { LockoutService, type LockoutClock } from '../../src/modules/lockout/lockout.service';
import { describeIfDocker } from './_docker';

const envForLockout = {
  get(key: string): number {
    switch (key) {
      case 'LOCKOUT_WINDOW_SECONDS':
        return 300;
      case 'LOCKOUT_THRESHOLD':
        return 5;
      case 'LOCKOUT_BLOCK_SECONDS':
        return 900;
      default:
        return 0;
    }
  },
} as never;

describeIfDocker('LockoutService (integration)', () => {
  let container: StartedMySqlContainer;
  let prisma: PrismaClient;
  let svc: LockoutService;
  let now = Date.now();
  const clock: LockoutClock = { now: () => now };

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
    await prisma.$executeRawUnsafe(
      `CREATE TABLE lockout (key_name VARCHAR(128) NOT NULL PRIMARY KEY,
       failures_json JSON NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
       ON UPDATE CURRENT_TIMESTAMP(3)) ENGINE=InnoDB`,
    );
    svc = new LockoutService(prisma as never, envForLockout);
    svc.setClock(clock);
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('DELETE FROM lockout');
    now = Date.now();
  });

  it('initial check returns blocked=false', async () => {
    expect(await svc.check('email:a@b.com')).toMatchObject({ blocked: false, failuresInWindow: 0 });
  });

  it('blocks after 5 failures inside window', async () => {
    for (let i = 0; i < 5; i++) await svc.registerFailure('email:a@b.com');
    const r = await svc.check('email:a@b.com');
    expect(r.blocked).toBe(true);
    expect(r.until?.getTime()).toBeGreaterThan(now);
  });

  it('does not block when failures fall outside window', async () => {
    for (let i = 0; i < 5; i++) await svc.registerFailure('email:a@b.com');
    now += 301 * 1000; // jump past window
    const r = await svc.check('email:a@b.com');
    expect(r.blocked).toBe(false);
  });

  it('reset() clears failures', async () => {
    for (let i = 0; i < 5; i++) await svc.registerFailure('email:a@b.com');
    await svc.reset('email:a@b.com');
    expect(await svc.check('email:a@b.com')).toMatchObject({ blocked: false });
  });

  it('email and ip keys are independent', async () => {
    for (let i = 0; i < 5; i++) await svc.registerFailure('email:a@b.com');
    expect((await svc.check('email:a@b.com')).blocked).toBe(true);
    expect((await svc.check('ip:1.2.3.4')).blocked).toBe(false);
  });

  it('block expires after LOCKOUT_BLOCK_SECONDS', async () => {
    for (let i = 0; i < 5; i++) await svc.registerFailure('email:a@b.com');
    expect((await svc.check('email:a@b.com')).blocked).toBe(true);
    now += 901 * 1000;
    expect((await svc.check('email:a@b.com')).blocked).toBe(false);
  });
});
