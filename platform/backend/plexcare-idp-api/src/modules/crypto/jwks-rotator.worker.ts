import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CronLockService } from '../../shared/cron/cron-lock.service';
import { KEY_ENCRYPTION, type KeyEncryption } from '../../shared/crypto/key-encryption.interface';
import { generateEd25519Key } from '../../shared/crypto/jwks';
import { KeyLoaderService } from '../../shared/crypto/key-loader.service';
import { signingKeyAgeDays } from '../../shared/metrics/metrics.registry';

const PREVIOUS_RETIRE_AFTER_DAYS = 180;

@Injectable()
export class JwksRotatorWorker {
  private readonly logger = new Logger(JwksRotatorWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lock: CronLockService,
    private readonly keyLoader: KeyLoaderService,
    @Inject(KEY_ENCRYPTION) private readonly kek: KeyEncryption,
  ) {}

  /** Monthly rotation: 1st of every month at 03:00. */
  @Cron('0 0 3 1 * *')
  async scheduled(): Promise<void> {
    if (process.env.IDP_DISABLE_WORKERS === 'true') return;
    await this.lock.withLock('jwks_rotate', 300, () => this.rotate());
  }

  async rotate(): Promise<void> {
    const material = await generateEd25519Key();
    const cipherBytes = await this.kek.wrap(Buffer.from(JSON.stringify(material.privateJwk)));

    await this.prisma.$transaction(async (tx) => {
      await tx.idpSigningKey.updateMany({
        where: { status: 'active' },
        data: { status: 'previous', rotatedAt: new Date() },
      });
      await tx.idpSigningKey.create({
        data: {
          kid: material.kid,
          alg: 'EdDSA',
          publicJwk: material.publicJwk as object,
          privateJwkEncrypted: cipherBytes,
          status: 'active',
        },
      });
      const retireBefore = new Date(Date.now() - PREVIOUS_RETIRE_AFTER_DAYS * 24 * 60 * 60 * 1000);
      await tx.idpSigningKey.updateMany({
        where: { status: 'previous', createdAt: { lt: retireBefore } },
        data: { status: 'retired' },
      });
    });

    this.keyLoader.invalidateCache();
    this.logger.log(`JWKS rotated, new kid=${material.kid}`);
    await this.updateAgeMetrics();
  }

  async updateAgeMetrics(): Promise<void> {
    const rows = await this.prisma.idpSigningKey.findMany({
      where: { status: { in: ['active', 'previous'] } },
    });
    for (const r of rows) {
      const ageDays = Math.floor((Date.now() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      signingKeyAgeDays.set({ status: r.status }, ageDays);
    }
  }
}
