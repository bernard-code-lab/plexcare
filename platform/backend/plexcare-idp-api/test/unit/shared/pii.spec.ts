import { hashDocument, hashEmail, maskEmail } from '../../../src/shared/auth/pii';

const ORIGINAL_PEPPER = process.env.PII_HASH_PEPPER;

afterAll(() => {
  if (ORIGINAL_PEPPER === undefined) delete process.env.PII_HASH_PEPPER;
  else process.env.PII_HASH_PEPPER = ORIGINAL_PEPPER;
});

describe('hashEmail', () => {
  it('produces stable 16-hex output', () => {
    delete process.env.PII_HASH_PEPPER;
    const a = hashEmail('felipe@plexcare.com.br');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(hashEmail('felipe@plexcare.com.br')).toBe(a);
  });

  it('is case- and trim-insensitive', () => {
    delete process.env.PII_HASH_PEPPER;
    expect(hashEmail('Felipe@PlexCare.com.br')).toBe(hashEmail('  felipe@plexcare.com.br '));
  });

  it('different emails → different hashes', () => {
    delete process.env.PII_HASH_PEPPER;
    expect(hashEmail('a@b.com')).not.toBe(hashEmail('c@d.com'));
  });

  it('pepper changes the output (mitigates rainbow tables)', () => {
    process.env.PII_HASH_PEPPER = 'pepper-1';
    const a = hashEmail('felipe@plexcare.com.br');
    process.env.PII_HASH_PEPPER = 'pepper-2';
    const b = hashEmail('felipe@plexcare.com.br');
    expect(a).not.toBe(b);
  });

  it('the raw email never appears inside the hex output', () => {
    delete process.env.PII_HASH_PEPPER;
    const h = hashEmail('felipe@plexcare.com.br');
    expect(h).not.toContain('felipe');
    expect(h).not.toContain('plexcare');
  });
});

describe('hashDocument', () => {
  it('CPF and CNPJ map to different hashes', () => {
    delete process.env.PII_HASH_PEPPER;
    expect(hashDocument('12345678909')).not.toBe(hashDocument('11222333000181'));
  });

  it('digits never appear inside the hex output', () => {
    delete process.env.PII_HASH_PEPPER;
    const h = hashDocument('12345678909');
    expect(h).not.toContain('123456789');
  });
});

describe('maskEmail', () => {
  it('keeps first char + domain, masks middle', () => {
    expect(maskEmail('felipe@plexcare.com.br')).toBe('f***@plexcare.com.br');
  });
  it('returns *** for malformed input', () => {
    expect(maskEmail('not-an-email')).toBe('***');
  });
});
