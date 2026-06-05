import { Module } from '@nestjs/common';
import { PkceService } from './pkce.service';

@Module({
  providers: [PkceService],
  exports: [PkceService],
})
export class AuthorizeModule {}
