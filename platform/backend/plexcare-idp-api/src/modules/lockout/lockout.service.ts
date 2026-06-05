import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EnvService } from '../../config/env.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { lockoutBlocksTotal } from '../../shared/metrics/metrics.registry';

export interface LockoutCheck {
  blocked: boolean;
  until?: Date;
  failuresInWindow: number;
}

interface FailureRecord {
  ts: number; // epoch ms
  kind?: string;
}

export interface LockoutClock {
  now(): number;
}

const realClock: LockoutClock = { now: () => Date.now() };

@Injectable()
export class LockoutService {
  private clock: LockoutClock = realClock;

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {}

  /** Test hook — override clock. */
  setClock(clock: LockoutClock): void {
    this.clock = clock;
  }

  async check(keyName: string): Promise<LockoutCheck> {
    const windowSec = this.env.get('LOCKOUT_WINDOW_SECONDS');
    const threshold = this.env.get('LOCKOUT_THRESHOLD');
    const blockSec = this.env.get('LOCKOUT_BLOCK_SECONDS');
    const now = this.clock.now();
    const windowStart = now - windowSec * 1000;

    const row = await this.prisma.lockout.findUnique({ where: { keyName } });
    if (!row) return { blocked: false, failuresInWindow: 0 };

    const failures = this.parseFailures(row.failuresJson);
    const recent = failures.filter((f) => f.ts >= windowStart);

    if (recent.length >= threshold) {
      const oldest = recent[0]!.ts;
      const until = new Date(oldest + blockSec * 1000);
      if (until.getTime() > now) {
        return { blocked: true, until, failuresInWindow: recent.length };
      }
    }
    return { blocked: false, failuresInWindow: recent.length };
  }

  async registerFailure(keyName: string, kind = 'bad_credentials'): Promise<void> {
    const windowSec = this.env.get('LOCKOUT_WINDOW_SECONDS');
    const threshold = this.env.get('LOCKOUT_THRESHOLD');
    const now = this.clock.now();
    const windowStart = now - windowSec * 1000;

    const row = await this.prisma.lockout.findUnique({ where: { keyName } });
    const existing = row ? this.parseFailures(row.failuresJson) : [];
    // Prune anything outside the window before appending — keeps the JSON small.
    const pruned = existing.filter((f) => f.ts >= windowStart);
    const next: FailureRecord[] = [...pruned, { ts: now, kind }];
    const payload = next as unknown as Prisma.InputJsonValue;
    await this.prisma.lockout.upsert({
      where: { keyName },
      create: { keyName, failuresJson: payload },
      update: { failuresJson: payload },
    });
    if (next.length >= threshold) {
      const keyKind = keyName.split(':')[0] ?? 'unknown';
      lockoutBlocksTotal.inc({ key_kind: keyKind });
    }
  }

  async reset(keyName: string): Promise<void> {
    await this.prisma.lockout.upsert({
      where: { keyName },
      create: { keyName, failuresJson: [] as unknown as Prisma.InputJsonValue },
      update: { failuresJson: [] as unknown as Prisma.InputJsonValue },
    });
  }

  private parseFailures(json: unknown): FailureRecord[] {
    if (!Array.isArray(json)) return [];
    return json
      .filter((v): v is { ts: number; kind?: string } => typeof v === 'object' && v !== null && 'ts' in v)
      .map((v) => ({ ts: Number(v.ts), ...(v.kind ? { kind: v.kind } : {}) }));
  }
}
