export const KEY_ENCRYPTION = Symbol('KEY_ENCRYPTION');

export interface KeyEncryption {
  /** Encrypts a plaintext payload (e.g. private JWK JSON bytes) with the KEK. */
  wrap(plaintext: Buffer): Promise<Buffer>;
  /** Decrypts a ciphertext produced by wrap(). */
  unwrap(ciphertext: Buffer): Promise<Buffer>;
}
