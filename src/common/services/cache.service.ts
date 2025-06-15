import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly namespacePrefix = 'app:';
  private readonly logger = new Logger();

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    const namespacedKey = this.namespaced(key);
    await this.cacheManager.set(namespacedKey, value, ttlSeconds);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const namespacedKey = this.namespaced(key);
      const result = await this.cacheManager.get<T>(namespacedKey);
      return result ?? null;
    } catch (error) {
      Logger.error(`Error while reading ${key} from cache`);
      return null; // return null it will be treated as cache miss
    }
  }

  async delete(key: string): Promise<boolean> {
    const namespacedKey = this.namespaced(key);
    await this.cacheManager.del(namespacedKey);
    return true; // Redis doesn't return a boolean by default
  }

  async clear(): Promise<void> {
    // This will clear all keys in Redis if the store supports it
    await this.cacheManager.clear();
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  private namespaced(key: string): string {
    return `${this.namespacePrefix}${key}`;
  }
}
