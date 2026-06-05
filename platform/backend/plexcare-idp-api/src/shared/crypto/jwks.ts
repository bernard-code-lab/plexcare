import { exportJWK, generateKeyPair, type JWK } from 'jose';

export interface Ed25519KeyMaterial {
  kid: string;
  publicJwk: JWK;
  privateJwk: JWK;
}

/**
 * Generate a fresh Ed25519 key pair with a kid based on date + random suffix.
 * Returns both public and private JWKs (caller is responsible for encrypting
 * the private one before persistence).
 */
export async function generateEd25519Key(kidPrefix = ''): Promise<Ed25519KeyMaterial> {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
  const publicJwk = (await exportJWK(publicKey)) as JWK;
  const privateJwk = (await exportJWK(privateKey)) as JWK;

  publicJwk.use = 'sig';
  publicJwk.alg = 'EdDSA';
  privateJwk.use = 'sig';
  privateJwk.alg = 'EdDSA';

  const stamp = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 8);
  const kid = `${kidPrefix || 'idp'}-${stamp}-${rand}`;
  publicJwk.kid = kid;
  privateJwk.kid = kid;

  return { kid, publicJwk, privateJwk };
}
