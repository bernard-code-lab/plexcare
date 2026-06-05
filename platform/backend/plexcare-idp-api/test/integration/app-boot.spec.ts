/**
 * Smoke E2E: full Nest app boot against a Testcontainers MySQL with the
 * legacy dump + migrations + seed loaded. Verifies that public endpoints
 * (/health, /.well-known/jwks.json, /metrics) respond and the JWKS exposes
 * the seeded active key.
 *
 * Skipped automatically when Docker is unavailable.
 */

// Defaults must be set BEFORE AppModule is imported (its ConfigModule
// validates env at module-load).
process.env.NODE_ENV ??= 'test';
process.env.JWKS_KEK_PROVIDER ??= 'env';
process.env.JWKS_KEK_DEV ??= Buffer.alloc(32, 1).toString('base64');
process.env.KEYCLOAK_BASE_URL ??= 'http://kc.invalid';
process.env.KEYCLOAK_REALM ??= 'plexcare';
process.env.KEYCLOAK_ADMIN_CLIENT_ID ??= 'admin';
process.env.KEYCLOAK_ADMIN_CLIENT_SECRET ??= 'secret';
process.env.ISSUER_URL ??= 'http://localhost:4000';
process.env.KAFKA_BROKERS ??= '';
process.env.IDP_DISABLE_WORKERS ??= 'true';
process.env.LOG_LEVEL ??= 'error';
process.env.CORS_ALLOWED_ORIGINS ??= 'http://localhost:5175';
// DATABASE_URL is overwritten in beforeAll after the container starts.
process.env.DATABASE_URL ??= 'mysql://placeholder:placeholder@localhost:3306/db';

import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes, createCipheriv } from 'node:crypto';
import { AppModule } from '../../src/app.module';
import { describeIfDocker } from './_docker';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DUMP_PATH = path.resolve(PROJECT_ROOT, '..', '..', 'database', 'db_plexcare_tenancy.sql');
const MIGRATIONS_DIR = path.resolve(PROJECT_ROOT, 'prisma', 'migrations');

function legacyOnlyDump(): string {
  const full = fs.readFileSync(DUMP_PATH, 'utf-8');
  const marker = '-- IDP module — added 2026-06-04';
  const idx = full.indexOf(marker);
  return idx === -1 ? full : full.slice(0, idx);
}

function wrap(kek: Buffer, plaintext: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

describeIfDocker('app boot (e2e)', () => {
  let container: StartedMySqlContainer;
  let app: NestFastifyApplication;
  const kek = randomBytes(32);

  beforeAll(async () => {
    container = await new MySqlContainer('mysql:8.0')
      .withDatabase('db_plexcare_tenancy')
      .withUsername('plexcare')
      .withUserPassword('plexcare')
      .withRootPassword('rootpass')
      .withCopyContentToContainer([{ content: legacyOnlyDump(), target: '/tmp/legacy.sql' }])
      .start();

    const load = await container.exec([
      'sh',
      '-c',
      'mysql -uroot -prootpass db_plexcare_tenancy < /tmp/legacy.sql',
    ]);
    if (load.exitCode !== 0) throw new Error(`legacy dump load failed: ${load.output}`);

    process.env.DATABASE_URL = `mysql://plexcare:plexcare@${container.getHost()}:${container.getPort()}/db_plexcare_tenancy`;
    process.env.JWKS_KEK_DEV = kek.toString('base64');

    // Apply migrations + seed via raw exec.
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$connect();
    const migrations = fs.readdirSync(MIGRATIONS_DIR).filter((d) => /^\d{14}_/.test(d)).sort();
    for (const dir of migrations) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf-8');
      const cleaned = sql
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n');
      const stmts = cleaned.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);
      for (const s of stmts) await prisma.$executeRawUnsafe(s);
    }
    // Seed signing key.
    const { generateEd25519Key } = await import('../../src/shared/crypto/jwks');
    const mat = await generateEd25519Key('test');
    const cipherBytes = wrap(kek, Buffer.from(JSON.stringify(mat.privateJwk)));
    await prisma.idpSigningKey.create({
      data: {
        kid: mat.kid,
        alg: 'EdDSA',
        publicJwk: mat.publicJwk as object,
        privateJwkEncrypted: cipherBytes,
        status: 'active',
      },
    });
    await prisma.$disconnect();

    const { SwaggerModule } = await import('@nestjs/swagger');
    const { buildOpenApiDocument } = await import('../../src/openapi/openapi.builder');
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ logger: false }));
    SwaggerModule.setup('docs', app, buildOpenApiDocument(), { jsonDocumentUrl: 'openapi.json' });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('GET /health → 200 {status:"alive"}', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'alive' });
  });

  it('GET /.well-known/jwks.json → 200 with 1 key', async () => {
    const res = await app.inject({ method: 'GET', url: '/.well-known/jwks.json' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { keys: Array<{ kid: string; alg: string }> };
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0]?.alg).toBe('EdDSA');
  });

  it('GET /.well-known/openid-configuration → 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/.well-known/openid-configuration' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ issuer: 'http://localhost:4000' });
  });

  it('GET /metrics → 200 prometheus format', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/^# HELP idp_/m);
  });

  it('GET /openapi.json → 200 with OpenAPI 3.1 doc', async () => {
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { openapi: string; paths: Record<string, unknown> };
    expect(body.openapi).toBe('3.1.0');
    expect(body.paths['/v1/auth/login']).toBeDefined();
  });

  it('POST /v1/auth/login → 400 when client_id unknown', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: {
        email: 'x@y.com',
        password: 'pw1',
        client_id: 'nonexistent',
        redirect_uri: 'http://localhost:5175/callback',
        code_challenge: 'a'.repeat(43),
        code_challenge_method: 'S256',
        state: 'abcdefghijklmnop',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.json()).toMatchObject({ code: 'pkce_state_invalid' });
  });

  it('GET /v1/me without token → 401 token_invalid', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'token_invalid' });
  });
});
