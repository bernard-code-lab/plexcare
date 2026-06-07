/**
 * Issue #3 — Feature: `tenant_uuid` exposto pelo idp-api
 *
 *   Scenario: dump canônico db_plexcare_tenancy.sql tem tenant_uuid em account
 *     Given que o dump canônico é a fonte do schema de account (vide CLAUDE.md
 *           gotcha "tabelas pré-existentes apenas mapeadas no Prisma")
 *     When inspeciono "platform/database/db_plexcare_tenancy.sql"
 *     Then a CREATE TABLE `account` tem a coluna "tenant_uuid CHAR(36) NOT NULL"
 *     And existe UNIQUE INDEX sobre "tenant_uuid"
 *
 * Esta abordagem (alterar o dump) preserva a convenção do monorepo (ADR-0011 §D-1
 * refinado em 2026-06-07): account é shared entre serviços, idp-api não cria
 * migration Prisma sobre ela.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('platform/database/db_plexcare_tenancy.sql', () => {
  const dumpPath = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'database',
    'db_plexcare_tenancy.sql',
  );
  const sql = fs.readFileSync(dumpPath, 'utf-8');

  // Extrai o bloco CREATE TABLE `account` ( ... ) ENGINE=InnoDB
  function accountCreateBlock(): string {
    const start = sql.indexOf('CREATE TABLE `account`');
    expect(start).toBeGreaterThan(-1);
    const end = sql.indexOf('ENGINE=', start);
    return sql.slice(start, end);
  }

  it('declara coluna tenant_uuid CHAR(36) NOT NULL em account', () => {
    const block = accountCreateBlock();
    expect(block).toMatch(/`tenant_uuid`\s+char\(36\)\s+NOT NULL/i);
  });

  it('cria UNIQUE INDEX idx_account_tenant_uuid sobre a coluna', () => {
    const block = accountCreateBlock();
    expect(block).toMatch(/UNIQUE\s+KEY\s+`idx_account_tenant_uuid`\s*\(`tenant_uuid`\)/i);
  });

  it('patch ALTER existe para ambientes pré-existentes', () => {
    const patchPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      'database',
      'patches',
      '2026-06-07-add-tenant-uuid-to-account.sql',
    );
    expect(fs.existsSync(patchPath)).toBe(true);
    const patch = fs.readFileSync(patchPath, 'utf-8');
    expect(patch).toMatch(/ALTER TABLE `account`/i);
    expect(patch).toMatch(/ADD COLUMN `tenant_uuid`/i);
    expect(patch).toMatch(/UNIQUE.*`idx_account_tenant_uuid`/i);
  });
});
