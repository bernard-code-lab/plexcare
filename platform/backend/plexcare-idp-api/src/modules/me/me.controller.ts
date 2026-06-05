import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../../shared/auth/jwt-auth.guard';
import { CurrentUser, type CurrentUserCtx } from '../../shared/auth/current-user';
import { ZodValidationPipe } from '../../shared/auth/zod-validation.pipe';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RoleResolverService } from '../roles/role-resolver.service';
import { SessionService } from '../sessions/session.service';
import { JwtSignerService } from '../../shared/crypto/jwt-signer.service';
import { ChangePasswordUseCase } from '../auth/application/change-password.use-case';
import { ChangePasswordDto, type ChangePasswordRequest } from '../auth/dto/password.dto';
import { buildAccessClaims } from '../token/application/jwt-claims.builder';
import { AppException } from '../../shared/errors/app-exception';

const SwitchAccountDto = z.object({
  account_id: z.string(),
  role: z.string().optional(),
});
type SwitchAccountRequest = z.infer<typeof SwitchAccountDto>;

@Controller({ path: 'v1' })
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleResolver: RoleResolverService,
    private readonly sessions: SessionService,
    private readonly signer: JwtSignerService,
    private readonly changePasswordUC: ChangePasswordUseCase,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: CurrentUserCtx) {
    const idpUser = await this.prisma.idpUser.findUnique({
      where: { id: user.idpUserId },
      include: { account: true },
    });
    if (!idpUser) throw new AppException('token_invalid', { detail: 'idp_user missing' });

    const { active, all } = await this.roleResolver.resolveActive({
      idpUserId: user.idpUserId,
      ...(user.accountId !== null ? { requestedAccountId: user.accountId } : {}),
    });

    return {
      idp_user_id: idpUser.id.toString(),
      email: idpUser.login,
      email_verified: user.emailVerified,
      active_role: active.role,
      customer: {
        id: idpUser.accountCustomerId.toString(),
      },
      account: {
        id: idpUser.accountId.toString(),
      },
      roles: all.map((r) => ({
        account_id: r.accountId.toString(),
        role: r.role,
        doctor_id: r.doctorId?.toString() ?? null,
        client_id: r.clientId?.toString() ?? null,
        employee_id: r.employeeId?.toString() ?? null,
        is_default: r.accountId === active.accountId && r.role === active.role,
      })),
    };
  }

  @Get('me/roles')
  async meRoles(@CurrentUser() user: CurrentUserCtx) {
    const { active, all } = await this.roleResolver.resolveActive({ idpUserId: user.idpUserId });
    return all.map((r) => ({
      account_id: r.accountId.toString(),
      role: r.role,
      doctor_id: r.doctorId?.toString() ?? null,
      client_id: r.clientId?.toString() ?? null,
      employee_id: r.employeeId?.toString() ?? null,
      is_default: r.accountId === active.accountId && r.role === active.role,
    }));
  }

  @Post('me/switch-account')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(SwitchAccountDto))
  async switchAccount(
    @CurrentUser() user: CurrentUserCtx,
    @Body() body: SwitchAccountRequest,
  ) {
    const requestedAccountId = BigInt(body.account_id);
    const resolveInput: Parameters<RoleResolverService['resolveActive']>[0] = {
      idpUserId: user.idpUserId,
      requestedAccountId,
    };
    if (body.role) resolveInput.requestedRole = body.role;
    const { active, all } = await this.roleResolver.resolveActive(resolveInput);

    const idpUser = await this.prisma.idpUser.findUniqueOrThrow({ where: { id: user.idpUserId } });
    const client = await this.prisma.idpClient.findUnique({ where: { clientId: user.clientId } });
    const accessTtl = client?.accessTokenTtlSeconds ?? 900;
    const refreshTtl = client?.refreshTokenTtlSeconds ?? 2_592_000;

    if (user.sessionId) {
      await this.sessions.revoke(user.sessionId, 'switch');
    }
    const access = await this.signer.sign(
      buildAccessClaims({
        idpUserId: user.idpUserId,
        email: idpUser.login,
        emailVerified: user.emailVerified,
        clientId: user.clientId,
        audience: client?.audience ?? user.clientId,
        active,
        all,
      }),
      accessTtl,
    );
    const refresh = await this.sessions.issueRefresh({
      idpUserId: user.idpUserId,
      accountId: active.accountId,
      clientId: user.clientId,
      ttlSeconds: refreshTtl,
    });
    return {
      access_token: access.token,
      refresh_token: refresh.refreshToken,
      id_token: access.token,
      token_type: 'Bearer' as const,
      expires_in: accessTtl,
      scope: 'openid profile email',
    };
  }

  @Get('me/sessions')
  async sessionsList(@CurrentUser() user: CurrentUserCtx) {
    const rows = await this.prisma.idpSession.findMany({
      where: { idpUserId: user.idpUserId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((s) => ({
      id: s.id,
      client_id: s.clientId,
      user_agent: s.userAgent,
      ip_address: s.ipAddress,
      created_at: s.createdAt.toISOString(),
      last_used_at: s.lastUsedAt.toISOString(),
      is_current: s.id === user.sessionId,
    }));
  }

  @Delete('me/sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(@CurrentUser() user: CurrentUserCtx, @Param('id') id: string) {
    const target = await this.prisma.idpSession.findUnique({ where: { id } });
    if (!target || target.idpUserId !== user.idpUserId) {
      // Do not leak existence — return 204 (idempotent revoke surface).
      return;
    }
    await this.sessions.revoke(id, 'logout');
  }

  @Post('auth/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(ChangePasswordDto))
  async changePassword(
    @CurrentUser() user: CurrentUserCtx,
    @Body() body: ChangePasswordRequest,
  ): Promise<void> {
    await this.changePasswordUC.execute({
      idpUserId: user.idpUserId,
      currentPassword: body.current_password,
      newPassword: body.new_password,
      email: user.email,
      ...(user.sessionId ? { currentSessionId: user.sessionId } : {}),
    });
  }
}
