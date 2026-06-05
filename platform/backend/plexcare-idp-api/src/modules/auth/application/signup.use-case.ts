import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { OutboxService } from '../../outbox/outbox.service';
import { KeycloakService } from '../../keycloak/keycloak.service';
import { AppException } from '../../../shared/errors/app-exception';
import { validatePassword } from '../../../shared/auth/password-policy';
import { isValidDocument } from '../../../shared/auth/document-validator';
import type { SignupRequest } from '../dto/signup.dto';

export interface SignupResult {
  idp_user_id: string;
  verification_sent_to: string;
  message: string;
}

@Injectable()
export class SignupUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kc: KeycloakService,
    private readonly outbox: OutboxService,
  ) {}

  async execute(input: SignupRequest, signupIp?: string): Promise<SignupResult> {
    validatePassword(input.password, 'signup_password_weak');
    const doc = isValidDocument(input.customer_document);
    if (!doc.ok) {
      throw new AppException('signup_password_weak', { detail: 'CPF/CNPJ inválido' });
    }
    const personType = input.person_type ?? doc.kind;

    // First create the user in Keycloak — only commit DB state if KC succeeded.
    const kcUserId = await this.kc.createUser({
      email: input.email,
      password: input.password,
      fullName: input.full_name,
      emailVerified: false,
    });

    const idpUser = await this.prisma.$transaction(async (tx) => {
      const created = await tx.idpUser.create({
        data: {
          login: input.email,
          keycloakUserId: kcUserId,
          // Multi-tenancy onboarding (assigning an account) is handled by a
          // separate flow; for self-signup the user is bound to a default
          // account = 1 (sandbox) until upgraded.
          accountId: 1n,
          accountCustomerId: 1n,
        },
      });
      await this.outbox.publish(tx, {
        type: 'idp.user.signed_up',
        subject: `idp_user/${created.id}`,
        data: {
          idp_user_id: created.id.toString(),
          keycloak_user_id: kcUserId,
          email: input.email,
          customer_document: doc.digits,
          person_type: personType,
          signup_client_id: input.client_id,
          signup_ip: signupIp ?? null,
        },
      });
      return created;
    });

    // Fire-and-forget the verification email (still inside the request to
    // surface KC failures, but failure here does not roll back the user).
    try {
      await this.kc.executeActionsEmail(kcUserId, ['VERIFY_EMAIL']);
    } catch {
      // Already logged inside KeycloakService; user can resend later.
    }

    return {
      idp_user_id: idpUser.id.toString(),
      verification_sent_to: input.email,
      message: 'Enviamos um link de verificação para seu email.',
    };
  }
}
