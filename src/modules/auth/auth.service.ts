import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // to login user with credentials
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email');
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.signRefreshToken({ sub: user.id }); // sign a lightweight refresh token only with {id: string}
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.saveRefreshToken(user.id, tokenHash);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  // register new user
  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new UnauthorizedException('Email already exists');
    }

    const user = await this.usersService.create(registerDto);

    const token = this.signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = this.signRefreshToken({ sub: user.id });
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.saveRefreshToken(user.id, tokenHash);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
      refreshToken,
    };
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.usersService.findOne(userId);

    if (!user) {
      return null;
    }

    return user;
  }

  async validateUserRoles(userId: string, requiredRoles: string[]): Promise<boolean> {
    const user = await this.usersService.findOne(userId);
    const role = user?.role;
    if (!role) return false;
    return requiredRoles.includes(role);
  }
  // acquire a access token silently
  async refreshTokens(token: string) {
    const payload = this.jwtService.verify(token, this.refreshTokenOption);
    if (!payload) {
      throw new UnauthorizedException('Invalid Token');
    }
    const user = await this.usersService.findOne(payload.sub);
    if (!user || !user.refreshToken) throw new ForbiddenException();

    const isValid = await bcrypt.compare(token, user.refreshToken);
    if (!isValid) {
      await this.usersService.saveRefreshToken(user.id, undefined); // Invalidate all
      throw new ForbiddenException('Token reuse detected');
    }
    const accessToken = this.signAccessToken({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = this.signRefreshToken({ sub: user.id });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.saveRefreshToken(user.id, tokenHash);

    return { accessToken, refreshToken: refreshToken };
  }

  public signAccessToken(payload: Record<string, unknown>) {
    return this.jwtService.sign(payload, this.accessTokenOption);
  }
  private signRefreshToken(payload: Record<string, unknown>) {
    return this.jwtService.sign(payload, this.refreshTokenOption);
  }
  private get refreshTokenOption(): JwtSignOptions {
    return {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    };
  }
  private get accessTokenOption(): JwtSignOptions {
    return {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    };
  }
}
