import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

@Injectable()
export class EnvService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true }) as Env[K];
  }

  /** Read N keys at once (useful for boot-time wiring). */
  pick<K extends keyof Env>(...keys: K[]): Pick<Env, K> {
    return keys.reduce<Pick<Env, K>>(
      (acc, k) => {
        acc[k] = this.get(k);
        return acc;
      },
      {} as Pick<Env, K>,
    );
  }
}
