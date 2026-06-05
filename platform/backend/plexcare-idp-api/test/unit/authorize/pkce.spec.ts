import {
  generateUrlSafe,
  sha256B64Url,
  verifyPkceChallenge,
} from '../../../src/modules/authorize/pkce.service';

describe('PKCE primitives', () => {
  it('generateUrlSafe(N) returns base64url with no padding', () => {
    const s = generateUrlSafe(32);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(s.length).toBeGreaterThanOrEqual(43);
  });

  it('verifyPkceChallenge accepts valid SHA-256 challenge', () => {
    const verifier = 'a'.repeat(50);
    const challenge = sha256B64Url(verifier);
    expect(verifyPkceChallenge(verifier, challenge)).toBe(true);
  });

  it('verifyPkceChallenge rejects mismatched verifier', () => {
    const verifier = 'a'.repeat(50);
    const challenge = sha256B64Url(verifier);
    expect(verifyPkceChallenge('different', challenge)).toBe(false);
  });
});
