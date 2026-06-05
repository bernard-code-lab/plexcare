import { Injectable } from '@nestjs/common';
import { SessionService } from '../../sessions/session.service';
import type { RevokeRequest } from '../dto/token.dto';

@Injectable()
export class RevokeTokenUseCase {
  constructor(private readonly sessions: SessionService) {}

  async execute(input: RevokeRequest): Promise<void> {
    await this.sessions.revoke(input.refresh_token, input.reason);
  }
}
