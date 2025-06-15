import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import * as redisStore from 'ioredis';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: redisStore,
        host: 'localhost',
        port: 6379,
        ttl: 60,
      }),
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}
