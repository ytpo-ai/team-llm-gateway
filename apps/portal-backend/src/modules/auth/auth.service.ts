import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const payload: JwtPayload = { sub: dto.email, email: dto.email, role: 'member' };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.configService.getOrThrow<string>(
        'jwt.refreshExpiresIn',
      ) as JwtSignOptions['expiresIn'],
    });
    return { accessToken, refreshToken };
  }
}
