import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;
    const ip = req.ip || req.connection?.remoteAddress;
    const user = req.user ? req.user.id || req.user.email || req.user.username : 'anonymous';
    const now = Date.now();

    // Log incoming request (excluding sensitive data)
    this.logger.log(`Incoming Request: ${method} ${url} | User: ${user} | IP: ${ip}`);

    return next.handle().pipe(
      tap({
        next: response => {
          // Optionally, you can log response size: JSON.stringify(response).length
          this.logger.log(
            `Outgoing Response: ${method} ${url} | User: ${user} | ${Date.now() - now}ms`,
          );
        },
        error: err => {
          this.logger.error(
            `Request Error: ${method} ${url} | User: ${user} | ${Date.now() - now}ms | Error: ${err?.message || err}`,
          );
        },
      }),
    );
  }
}
