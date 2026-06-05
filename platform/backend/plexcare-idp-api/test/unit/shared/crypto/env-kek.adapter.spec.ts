import { randomBytes } from 'node:crypto';
import { EnvKekAdapter } from '../../../../src/shared/crypto/env-kek.adapter';

const kekBase64 = randomBytes(32).toString('base64');

describe('EnvKekAdapter', () => {
  let kek: EnvKekAdapter;

  beforeEach(() => {
    kek = new EnvKekAdapter(kekBase64);
  });

  it('rejects KEK that is not 32 bytes', () => {
    expect(() => new EnvKekAdapter(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });

  it('wrap → unwrap roundtrip recovers plaintext', async () => {
    const plain = Buffer.from(JSON.stringify({ kty: 'OKP', crv: 'Ed25519', d: 'abcd' }), 'utf-8');
    const ct = await kek.wrap(plain);
    expect(ct).not.toEqual(plain);
    const back = await kek.unwrap(ct);
    expect(back.equals(plain)).toBe(true);
  });

  it('produces different ciphertext for same plaintext (random IV)', async () => {
    const plain = Buffer.from('same input');
    const a = await kek.wrap(plain);
    const b = await kek.wrap(plain);
    expect(a.equals(b)).toBe(false);
  });

  it('unwrap fails on tampered ciphertext (auth tag mismatch)', async () => {
    const ct = await kek.wrap(Buffer.from('hello'));
    ct[ct.length - 1] = ct[ct.length - 1]! ^ 0xff;
    await expect(kek.unwrap(ct)).rejects.toThrow();
  });

  it('unwrap fails when KEK differs', async () => {
    const ct = await kek.wrap(Buffer.from('hello'));
    const otherKek = new EnvKekAdapter(randomBytes(32).toString('base64'));
    await expect(otherKek.unwrap(ct)).rejects.toThrow();
  });

  it('unwrap rejects ciphertext shorter than IV+tag', async () => {
    await expect(kek.unwrap(Buffer.alloc(10))).rejects.toThrow(/too short/);
  });
});
