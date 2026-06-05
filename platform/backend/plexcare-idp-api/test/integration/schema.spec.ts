import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { describeIfDocker } from './_docker';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DUMP_PATH = path.resolve(PROJECT_ROOT, '..', '..', 'database', 'db_plexcare_tenancy.sql');
const MIGRATIONS_DIR = path.resolve(PROJECT_ROOT, 'prisma', 'migrations');

/**
 * The legacy dump ends with the IDP module block (mirror of migrations, with
 * `CREATE TABLE IF NOT EXISTS`). We truncate at that marker so the test can
 * apply the migration SQLs cleanly and verify they produce the expected schema.
 */
function legacyOnlyDump(): string {
  const full = fs.readFileSync(DUMP_PATH, 'utf-8');
  const marker = '-- IDP module — added 2026-06-04';
  const idx = full.indexOf(marker);
  return idx === -1 ? full : full.slice(0, idx);
}

describeIfDocker('schema migrations', () => {
  let container: StartedMySqlContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const legacy = legacyOnlyDump();

    container = await new MySqlContainer('mysql:8.0')
      .withDatabase('db_plexcare_tenancy')
      .withUsername('plexcare')
      .withUserPassword('plexcare')
      .withRootPassword('rootpass')
      .withCopyContentToContainer([{ content: legacy, target: '/tmp/legacy.sql' }])
      .start();

    const url = `mysql://${container.getUsername()}:${container.getUserPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;

    const load = await container.exec([
      'sh',
      '-c',
      'mysql -uroot -prootpass db_plexcare_tenancy < /tmp/legacy.sql',
    ]);
    if (load.exitCode !== 0) {
      throw new Error(`legacy dump load failed (${load.exitCode}): ${load.output}`);
    }

    prisma = new PrismaClient({ datasourceUrl: url });
    await prisma.$connect();

    // Apply each migration SQL directly (bypasses _prisma_migrations table —
    // we're testing the DDLs, not the migration journal).
    const migrations = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((d) => /^\d{14}_/.test(d))
      .sort();
    for (const dir of migrations) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf-8');
      // Strip line comments, then split on `;` boundaries, keep only non-empty
      // statements with actual DDL.
      const cleaned = sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n');
      const statements = cleaned
        .split(/;\s*(?:\n|$)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of statements) {
        await prisma.$executeRawUnsafe(stmt);
      }
    }
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it.each([
    'idp_user_role',
    'idp_session',
    'idp_signing_key',
    'idp_client',
    'idp_cron_lock',
    'idp_idempotency',
  ])('creates table %s', async (tableName) => {
    const rows = await prisma.$queryRawUnsafe<Array<{ TABLE_NAME: string }>>(
      `SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_NAME = ?`,
      tableName,
    );
    expect(rows).toHaveLength(1);
  });

  it('idp_user_role has unique constraint uq_idp_user_role', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ INDEX_NAME: string }>>(
      `SELECT DISTINCT INDEX_NAME FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND TABLE_NAME = 'idp_user_role' AND NON_UNIQUE = 0`,
    );
    expect(rows.map((r) => r.INDEX_NAME)).toEqual(expect.arrayContaining(['uq_idp_user_role']));
  });

  it('idp_session FK to idp_user is on delete cascade', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ DELETE_RULE: string }>>(
      `SELECT DELETE_RULE FROM information_schema.referential_constraints
       WHERE constraint_schema = DATABASE() AND CONSTRAINT_NAME = 'fk_idp_session_user'`,
    );
    expect(rows[0]?.DELETE_RULE).toBe('CASCADE');
  });
});
