import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { KeyEncryption } from './key-encryption.interface';

/**
 * Env-based KEK adapter for dev/test ONLY.
 * Wrap format: [12-byte IV | 16-byte AuthTag | ciphertext], AES-256-GCM.
 * Boot in production with this adapter is rejected by EnvSchema gating.
 */
@Injectable()
export class EnvKekAdapter implements KeyEncryption {
  private readonly kek: Buffer;

  constructor(kekBase64: string) {
    const buf = Buffer.from(kekBase64, 'base64');
    if (buf.length !== 32) {
      throw new Error(
        `EnvKekAdapter: JWKS_KEK_DEV must decode to 32 bytes (got ${buf.length})`,
      );
    }
    this.kek = buf;
  }

  async wrap(plaintext: Buffer): Promise<Buffer> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.kek, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  }

  async unwrap(ciphertext: Buffer): Promise<Buffer> {
    if (ciphertext.length < 28) {
      throw new Error('EnvKekAdapter: ciphertext too short');
    }
    const iv = ciphertext.subarray(0, 12);
    const tag = ciphertext.subarray(12, 28);
    const data = ciphertext.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
}
