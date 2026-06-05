import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { KeycloakService } from '../keycloak/keycloak.service';
import { KeyLoaderService } from '../../shared/crypto/key-loader.service';

interface ReadyBody {
  mysql: 'ok' | 'down';
  keycloak: 'ok' | 'down';
  kafka: 'unknown';
  signing_key_age_days: number | null;
}

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kc: KeycloakService,
    private readonly keyLoader: KeyLoaderService,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  health(): { status: 'alive' } {
    return { status: 'alive' };
  }

  @Get('ready')
  async ready(@Res() res: FastifyReply): Promise<void> {
    const body: ReadyBody = {
      mysql: 'down',
      keycloak: 'down',
      kafka: 'unknown',
      signing_key_age_days: null,
    };
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      body.mysql = 'ok';
    } catch {
      body.mysql = 'down';
    }
    body.keycloak = (await this.kc.ping()) ? 'ok' : 'down';
    try {
      const keys = await this.keyLoader.loadAll();
      const active = keys.find((k) => k.status === 'active');
      if (active) {
        // publicJwk has no createdAt; fetch from DB.
        const row = await this.prisma.idpSigningKey.findUnique({ where: { kid: active.kid } });
        if (row) {
          body.signing_key_age_days = Math.floor(
            (Date.now() - row.createdAt.getTime()) / (1000 * 60 * 60 * 24),
          );
        }
      }
    } catch {
      // leave signing_key_age_days as null
    }

    const allOk = body.mysql === 'ok' && body.keycloak === 'ok';
    res.status(allOk ? 200 : 503).send(body);
  }
}
