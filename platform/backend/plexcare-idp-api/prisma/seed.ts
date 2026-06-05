import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes } from 'node:crypto';
import { generateEd25519Key } from '../src/shared/crypto/jwks';

/**
 * Dev seed:
 *  - 2 OIDC clients (login-web, platform-web)
 *  - 1 active Ed25519 signing key encrypted with JWKS_KEK_DEV
 *
 * Run with: npx tsx prisma/seed.ts (or `npm run prisma:seed` once configured).
 */

function wrap(kek: Buffer, plaintext: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const kekB64 = process.env.JWKS_KEK_DEV;
    if (!kekB64) throw new Error('JWKS_KEK_DEV missing — set it in .env first');
    const kek = Buffer.from(kekB64, 'base64');
    if (kek.length !== 32) throw new Error('JWKS_KEK_DEV must decode to 32 bytes');

    await prisma.idpClient.upsert({
      where: { clientId: 'plexcare-login-web' },
      create: {
        clientId: 'plexcare-login-web',
        name: 'PlexCare Login Web',
        audience: 'plexcare-login-web',
        redirectUris: ['http://localhost:5175/callback'],
        allowedGrants: ['authorization_code', 'refresh_token'],
      },
      update: {},
    });
    await prisma.idpClient.upsert({
      where: { clientId: 'plexcare-platform-web' },
      create: {
        clientId: 'plexcare-platform-web',
        name: 'PlexCare Platform Web',
        audience: 'plexcare-platform-web',
        redirectUris: ['http://localhost:5176/callback'],
        allowedGrants: ['authorization_code', 'refresh_token'],
      },
      update: {},
    });

    const existingActive = await prisma.idpSigningKey.findFirst({ where: { status: 'active' } });
    if (!existingActive) {
      const mat = await generateEd25519Key('dev');
      const cipher = wrap(kek, Buffer.from(JSON.stringify(mat.privateJwk)));
      await prisma.idpSigningKey.create({
        data: {
          kid: mat.kid,
          alg: 'EdDSA',
          publicJwk: mat.publicJwk as object,
          privateJwkEncrypted: cipher,
          status: 'active',
        },
      });
      // eslint-disable-next-line no-console
      console.log(`Seeded signing key kid=${mat.kid}`);
    }
    // eslint-disable-next-line no-console
    console.log('Seed complete');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
