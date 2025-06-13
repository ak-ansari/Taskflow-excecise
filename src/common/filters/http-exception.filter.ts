import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception.getResponse();

    // Determine error message and details
    let message = 'An unexpected error occurred';
    let errorDetails: any = {};

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      message = (exceptionResponse as any).message || exception.message || message;
      errorDetails = { ...(exceptionResponse as object) };
      delete errorDetails.message;
      delete errorDetails.statusCode;
    } else {
      message = exception.message || message;
    }

    // Log error with appropriate severity
    if (status >= 500) {
      this.logger.error(
        `HTTP ${status} Error: ${message}`,
        exception.stack,
        HttpExceptionFilter.name,
      );
    } else if (status >= 400) {
      this.logger.warn(`HTTP ${status} Warning: ${message}`, HttpExceptionFilter.name);
    } else {
      this.logger.log(`HTTP ${status}: ${message}`, HttpExceptionFilter.name);
    }

    // Consistent error response
    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(Object.keys(errorDetails).length > 0 ? { details: errorDetails } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
