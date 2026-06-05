import { Injectable } from '@nestjs/common';
import type { KeyEncryption } from './key-encryption.interface';

/**
 * Placeholder AWS KMS adapter. Implementation lands when a cloud target is
 * defined (AWS/Azure/DO). The boot pipeline must abort if this adapter is
 * selected in production before the implementation exists.
 */
@Injectable()
export class KmsKekAdapter implements KeyEncryption {
  constructor(_keyId: string) {
    // keyId stored for the real implementation; ignored here.
  }

  async wrap(_plaintext: Buffer): Promise<Buffer> {
    throw new Error(
      'KmsKekAdapter not implemented yet — define cloud target and wire AWS KMS SDK',
    );
  }

  async unwrap(_ciphertext: Buffer): Promise<Buffer> {
    throw new Error(
      'KmsKekAdapter not implemented yet — define cloud target and wire AWS KMS SDK',
    );
  }
}
