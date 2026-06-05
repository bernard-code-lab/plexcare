import * as fs from 'node:fs';
import * as path from 'node:path';

describe('prisma/schema.prisma', () => {
  const schema = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'prisma', 'schema.prisma'),
    'utf-8',
  );

  it.each([
    'model Account',
    'model IdpUser',
    'model AuthorizeState',
    'model Outbox',
    'model Lockout',
    'model Employee',
    'model Client',
    'model ClientProfile',
    'model IdpUserRole',
    'model IdpSession',
    'model IdpSigningKey',
    'model IdpClient',
    'model IdpCronLock',
    'model IdpIdempotency',
  ])('declares %s', (decl) => {
    expect(schema).toContain(decl);
  });

  it('points datasource to env DATABASE_URL', () => {
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
  });

  it('uses provider mysql', () => {
    expect(schema).toMatch(/provider\s*=\s*"mysql"/);
  });
});

describe('prisma/migrations', () => {
  const dir = path.resolve(__dirname, '..', '..', 'prisma', 'migrations');

  it.each([
    '20260604000001_add_idp_user_role',
    '20260604000002_add_idp_session',
    '20260604000003_add_idp_signing_key',
    '20260604000004_add_idp_client',
    '20260604000005_add_idp_cron_lock',
    '20260604000006_add_idp_idempotency',
  ])('contains migration %s', (name) => {
    const migrationFile = path.join(dir, name, 'migration.sql');
    expect(fs.existsSync(migrationFile)).toBe(true);
    expect(fs.readFileSync(migrationFile, 'utf-8')).toMatch(/CREATE TABLE/i);
  });
});
