import { Global, Module } from '@nestjs/common';
import { KeyLoaderService } from './key-loader.service';
import { JwtSignerService } from './jwt-signer.service';
import { keyEncryptionProvider } from './key-encryption.factory';

@Global()
@Module({
  providers: [keyEncryptionProvider, KeyLoaderService, JwtSignerService],
  exports: [KeyLoaderService, JwtSignerService, keyEncryptionProvider],
})
export class CryptoModule {}
