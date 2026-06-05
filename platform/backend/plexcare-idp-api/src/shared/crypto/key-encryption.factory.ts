import { EnvService } from '../../config/env.service';
import { EnvKekAdapter } from './env-kek.adapter';
import { KmsKekAdapter } from './kms-kek.adapter';
import { KEY_ENCRYPTION, KeyEncryption } from './key-encryption.interface';

export const keyEncryptionProvider = {
  provide: KEY_ENCRYPTION,
  inject: [EnvService],
  useFactory: (env: EnvService): KeyEncryption => {
    const provider = env.get('JWKS_KEK_PROVIDER');
    if (provider === 'env') {
      const kek = env.get('JWKS_KEK_DEV');
      if (!kek) {
        throw new Error('JWKS_KEK_DEV missing for provider=env (should be caught by env schema)');
      }
      return new EnvKekAdapter(kek);
    }
    const keyId = env.get('JWKS_KMS_KEY_ID');
    if (!keyId) {
      throw new Error('JWKS_KMS_KEY_ID missing for provider=kms (should be caught by env schema)');
    }
    return new KmsKekAdapter(keyId);
  },
};
