import { SignJWT, importJWK, exportJWK, generateSecret } from 'jose';
import {
  JwtSignerService,
  ALG,
  type IdpClaims,
} from '../../../../src/shared/crypto/jwt-signer.service';
import {
  KeyLoaderService,
  type LoadedKey,
} from '../../../../src/shared/crypto/key-loader.service';
import { generateEd25519Key } from '../../../../src/shared/crypto/jwks';
import { AppException } from '../../../../src/shared/errors/app-exception';

class StubKeyLoader {
  private active!: LoadedKey;
  private previous!: LoadedKey;

  constructor(active: LoadedKey, previous: LoadedKey) {
    this.active = active;
    this.previous = previous;
  }

  async loadActive(): Promise<LoadedKey> {
    return this.active;
  }

  async getPrivateKey(loaded: LoadedKey): Promise<unknown> {
    return loaded.privateKey;
  }

  async getPublicKey(kid: string): Promise<{ key: unknown; loaded: LoadedKey } | null> {
    if (kid === this.active.kid) return { key: this.active.publicKey, loaded: this.active };
    if (kid === this.previous.kid) return { key: this.previous.publicKey, loaded: this.previous };
    return null;
  }
}

const ISSUER = 'http://localhost:4000';
const env = { get: (k: string) => (k === 'ISSUER_URL' ? ISSUER : '') } as never;

async function buildLoadedKey(): Promise<LoadedKey> {
  const mat = await generateEd25519Key();
  const privateKey = await importJWK(mat.privateJwk, ALG);
  const publicKey = await importJWK(mat.publicJwk, ALG);
  return {
    kid: mat.kid,
    alg: ALG,
    status: 'active',
    publicJwk: mat.publicJwk,
    privateKey: privateKey as never,
    publicKey: publicKey as never,
  };
}

describe('JwtSignerService', () => {
  let active: LoadedKey;
  let previous: LoadedKey;
  let signer: JwtSignerService;

  beforeAll(async () => {
    active = await buildLoadedKey();
    previous = await buildLoadedKey();
    previous.status = 'previous';
    const loader = new StubKeyLoader(active, previous);
    signer = new JwtSignerService(loader as unknown as KeyLoaderService, env);
  });

  const baseClaims: IdpClaims = {
    sub: '1',
    client_id: 'plexcare-platform-web',
    account_id: '2',
    account_customer_id: '2',
    active_role: 'doctor',
    roles: ['doctor'],
    email: 'felipe@plexcare.com.br',
    email_verified: true,
    audience: 'plexcare-platform-web',
  };

  it('sign produces JWT with header alg=EdDSA, typ=JWT, active kid', async () => {
    const { token, kid } = await signer.sign(baseClaims, 900);
    expect(kid).toBe(active.kid);
    const [header64] = token.split('.');
    const header = JSON.parse(Buffer.from(header64!, 'base64url').toString('utf-8'));
    expect(header).toMatchObject({ alg: 'EdDSA', typ: 'JWT', kid: active.kid });
  });

  it('sign sets exp = iat + ttlSeconds and iss/aud/sub correctly', async () => {
    const { token, iat, exp } = await signer.sign(baseClaims, 900);
    expect(exp - iat).toBe(900);
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf-8'));
    expect(payload).toMatchObject({
      iss: ISSUER,
      sub: '1',
      aud: 'plexcare-platform-web',
      active_role: 'doctor',
      email_verified: true,
    });
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('verify accepts a freshly signed JWT', async () => {
    const { token } = await signer.sign(baseClaims, 900);
    const claims = await signer.verify(token);
    expect(claims.sub).toBe('1');
    expect(claims.kid).toBe(active.kid);
  });

  it('verify accepts when expectedAudience matches', async () => {
    const { token } = await signer.sign(baseClaims, 900);
    const claims = await signer.verify(token, 'plexcare-platform-web');
    expect(claims.sub).toBe('1');
  });

  it('verify accepts when expectedAudience list includes the token aud', async () => {
    const { token } = await signer.sign(baseClaims, 900);
    const claims = await signer.verify(token, ['other-client', 'plexcare-platform-web']);
    expect(claims.sub).toBe('1');
  });

  it('verify REJECTS when expectedAudience does not match token aud (P0-2)', async () => {
    const { token } = await signer.sign(baseClaims, 900);
    await expect(signer.verify(token, 'attacker-client')).rejects.toMatchObject({
      code: 'token_invalid',
    });
  });

  it('verify REJECTS when token aud is not in expectedAudience list (P0-2)', async () => {
    const { token } = await signer.sign(baseClaims, 900);
    await expect(
      signer.verify(token, ['plexcare-mobile', 'other-cli']),
    ).rejects.toMatchObject({ code: 'token_invalid' });
  });

  it('verify rejects token signed with unknown kid', async () => {
    const otherKey = await generateEd25519Key();
    const priv = await importJWK(otherKey.privateJwk, ALG);
    const evil = await new SignJWT({})
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: 'forged-kid' })
      .setIssuer(ISSUER)
      .setSubject('1')
      .setAudience('x')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(priv);
    await expect(signer.verify(evil)).rejects.toMatchObject({
      code: 'token_invalid',
      detail: expect.stringContaining('Unknown kid'),
    });
  });

  it('verify rejects token with alg=HS256 even if kid is known', async () => {
    const secret = await generateSecret('HS256');
    const evil = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid: active.kid })
      .setIssuer(ISSUER)
      .setSubject('1')
      .setAudience('x')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(secret);
    await expect(signer.verify(evil)).rejects.toMatchObject({
      code: 'token_invalid',
      detail: expect.stringMatching(/Algorithm HS256/),
    });
  });

  it('verify rejects malformed JWT', async () => {
    await expect(signer.verify('not-a-jwt')).rejects.toBeInstanceOf(AppException);
  });

  it('verify rejects token signed by another private key (signature mismatch)', async () => {
    const otherKey = await generateEd25519Key();
    const priv = await importJWK(otherKey.privateJwk, ALG);
    // Use a known kid but a foreign private key — signature won't validate against
    // the public key associated with that kid.
    const evil = await new SignJWT({})
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: active.kid })
      .setIssuer(ISSUER)
      .setSubject('1')
      .setAudience('x')
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(priv);
    await expect(signer.verify(evil)).rejects.toMatchObject({
      code: 'token_invalid',
      detail: expect.stringContaining('Signature'),
    });
  });

  it('verify accepts token signed with a previous key (grace period)', async () => {
    const previousActiveSigner = new JwtSignerService(
      new StubKeyLoader(previous, active) as unknown as KeyLoaderService,
      env,
    );
    const { token } = await previousActiveSigner.sign(baseClaims, 60);
    const claims = await signer.verify(token);
    expect(claims.kid).toBe(previous.kid);
  });

  it('exports ALG = EdDSA constant for use in other modules', () => {
    expect(ALG).toBe('EdDSA');
  });
});
