import { Inject, Injectable, Logger } from '@nestjs/common';
import { importJWK, KeyLike, type JWK } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../errors/app-exception';
import { KEY_ENCRYPTION, KeyEncryption } from './key-encryption.interface';

export type KeyStatus = 'active' | 'previous' | 'retired';

export interface LoadedKey {
  kid: string;
  alg: string;
  status: KeyStatus;
  publicJwk: JWK;
  /** Lazily imported when verify/sign is called for this kid. */
  privateKey?: KeyLike;
  publicKey?: KeyLike;
}

interface CacheEntry {
  loadedAt: number;
  keys: LoadedKey[];
}

const CACHE_TTL_MS = 60_000;

@Injectable()
export class KeyLoaderService {
  private readonly logger = new Logger(KeyLoaderService.name);
  private cache: CacheEntry | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(KEY_ENCRYPTION) private readonly kek: KeyEncryption,
  ) {}

  /** Returns all non-retired keys (active + previous), sorted active first. */
  async loadAll(force = false): Promise<LoadedKey[]> {
    if (!force && this.cache && Date.now() - this.cache.loadedAt < CACHE_TTL_MS) {
      return this.cache.keys;
    }
    const rows = await this.prisma.idpSigningKey.findMany({
      where: { status: { in: ['active', 'previous'] } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    const keys: LoadedKey[] = rows.map((r) => ({
      kid: r.kid,
      alg: r.alg,
      status: r.status as KeyStatus,
      publicJwk: r.publicJwk as unknown as JWK,
    }));
    this.cache = { loadedAt: Date.now(), keys };
    return keys;
  }

  async loadActive(): Promise<LoadedKey> {
    const keys = await this.loadAll();
    const active = keys.find((k) => k.status === 'active');
    if (!active) {
      throw new AppException('service_unavailable', {
        detail: 'No active signing key — initial JWKS rotation pending',
      });
    }
    return active;
  }

  async getPrivateKey(loaded: LoadedKey): Promise<KeyLike> {
    if (loaded.privateKey) return loaded.privateKey;
    const row = await this.prisma.idpSigningKey.findUnique({ where: { kid: loaded.kid } });
    if (!row) throw new AppException('token_invalid', { detail: `Signing key ${loaded.kid} not found` });
    const privateJwkBytes = await this.kek.unwrap(Buffer.from(row.privateJwkEncrypted));
    const privateJwk = JSON.parse(privateJwkBytes.toString('utf-8')) as JWK;
    const key = (await importJWK(privateJwk, loaded.alg)) as KeyLike;
    loaded.privateKey = key;
    return key;
  }

  async getPublicKey(kid: string): Promise<{ key: KeyLike; loaded: LoadedKey } | null> {
    const keys = await this.loadAll();
    const loaded = keys.find((k) => k.kid === kid);
    if (!loaded) return null;
    if (!loaded.publicKey) {
      loaded.publicKey = (await importJWK(loaded.publicJwk, loaded.alg)) as KeyLike;
    }
    return { key: loaded.publicKey, loaded };
  }

  /** Public JWK set for /.well-known/jwks.json (no private material). */
  async getJwks(): Promise<{ keys: JWK[] }> {
    const keys = await this.loadAll();
    return { keys: keys.map((k) => k.publicJwk) };
  }

  invalidateCache(): void {
    this.cache = null;
    this.logger.debug('signing key cache invalidated');
  }
}
