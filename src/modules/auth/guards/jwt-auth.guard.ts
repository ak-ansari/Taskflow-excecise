import { Injectable, ExecutionContext, UnauthorizedException, CanActivate } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()

// auth guard to protect routes (jwt strategy)
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expect "Bearer <token>"

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get('jwt.secret'),
      });
      const user = await this.authService.validateUser(decoded.sub);
      if (!user) throw new UnauthorizedException('Invalid user');
      request.user = decoded; // Attach user info to request
      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
