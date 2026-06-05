import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'node:os';
import { PrismaService } from '../prisma/prisma.service';

const HOLDER = `${hostname()}/${process.pid}`;

@Injectable()
export class CronLockService {
  private readonly logger = new Logger(CronLockService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Acquire a named lock for `ttlSeconds`. Returns true if we hold it, false
   * if another holder has it and the TTL has not elapsed. Implementation uses
   * UPSERT + a conditional update that races safely across replicas.
   */
  async tryAcquire(name: string, ttlSeconds: number): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    try {
      // Path A: insert when no row exists.
      await this.prisma.idpCronLock.create({ data: { name, holder: HOLDER, expiresAt } });
      return true;
    } catch {
      // Path B: row exists; only steal it if expired.
      const updated = await this.prisma.idpCronLock.updateMany({
        where: { name, expiresAt: { lt: new Date() } },
        data: { holder: HOLDER, expiresAt },
      });
      return updated.count === 1;
    }
  }

  async release(name: string): Promise<void> {
    await this.prisma.idpCronLock.deleteMany({ where: { name, holder: HOLDER } });
  }

  /**
   * Convenience wrapper. Runs `fn()` only if the lock is acquired.
   */
  async withLock(name: string, ttlSeconds: number, fn: () => Promise<void>): Promise<boolean> {
    const acquired = await this.tryAcquire(name, ttlSeconds);
    if (!acquired) return false;
    try {
      await fn();
      return true;
    } catch (err) {
      this.logger.error(`cron ${name} failed`, (err as Error).stack);
      throw err;
    } finally {
      await this.release(name);
    }
  }
}
