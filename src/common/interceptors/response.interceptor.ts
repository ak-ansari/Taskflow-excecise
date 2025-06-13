import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { HttpResponse } from '../../types/http-response.interface';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<HttpResponse<unknown>> {
    return next.handle().pipe(
      map(data => {
        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          path: context.switchToHttp().getRequest().url,
        };
      }),
    );
  }
}
