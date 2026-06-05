import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { KeycloakService } from '../../keycloak/keycloak.service';

const MIN_RESPONSE_MS = 300;

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kc: KeycloakService,
  ) {}

  /**
   * Always responds 204 with a minimum 300ms delay. Email enumeration is
   * mitigated by symmetric timing.
   */
  async execute(email: string): Promise<void> {
    const started = Date.now();
    const user = await this.prisma.idpUser.findFirst({ where: { login: email } });
    if (user) {
      try {
        await this.kc.executeActionsEmail(user.keycloakUserId, ['UPDATE_PASSWORD']);
      } catch {
        // silent — anti-enumeration
      }
    }
    const elapsed = Date.now() - started;
    if (elapsed < MIN_RESPONSE_MS) {
      await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
    }
  }
}
