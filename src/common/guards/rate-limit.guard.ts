import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';

const RATE_LIMIT_KEY = 'rate_limit_options';

export const RateLimit =
  (points: number, duration: number) => (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata(
      RATE_LIMIT_KEY,
      { points, duration },
      descriptor ? descriptor.value : target,
    );
    return descriptor;
  };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private defaultPoints = 100;
  private defaultDuration = 60; // seconds

  private redisClient = new Redis({
    host: 'localhost',
    port: 6379,
  });

  private rateLimiter = new RateLimiterRedis({
    storeClient: this.redisClient,
    points: this.defaultPoints,
    duration: this.defaultDuration,
    keyPrefix: 'rateLimiter',
  });

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;

    const handler = context.getHandler();
    const classRef = context.getClass();
    const options =
      this.reflector.get(RATE_LIMIT_KEY, handler) || this.reflector.get(RATE_LIMIT_KEY, classRef);

    let limiter = this.rateLimiter;
    if (options) {
      limiter = new RateLimiterRedis({
        storeClient: this.redisClient,
        points: options.points,
        duration: options.duration,
        keyPrefix: `rateLimiter_${handler.name}`,
      });
    }

    try {
      await limiter.consume(ip);
      return true;
    } catch (rejRes: any) {
      throw new HttpException(
        {
          status: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again later.`,
          limit: options?.points || this.defaultPoints,
          remaining: Math.max(0, rejRes.remainingPoints),
          retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
