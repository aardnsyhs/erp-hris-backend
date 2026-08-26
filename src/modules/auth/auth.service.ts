import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import ms from 'ms';
import type { StringValue } from 'ms';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { AuthUserDto } from './dto/auth-response.dto';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResult> {
    const genericErrorMessage = 'Email atau password tidak valid';

    const user = await this.authRepository.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException(genericErrorMessage);
    }

    if (!user.isActive) {
      throw new UnauthorizedException(genericErrorMessage);
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException(genericErrorMessage);
    }

    // 1. Generate short-lived Access Token (10-15m)
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload);

    // 2. Generate longer-lived Refresh Token (7d)
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiryStr = this.configService.get<StringValue>('JWT_REFRESH_EXPIRATION', '7d');

    const refreshPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshExpiryStr,
    });

    // 3. Hash refresh token and save to database
    const saltRounds = 10;
    const refreshTokenHash = await bcrypt.hash(refreshToken, saltRounds);
    const expiryMs = ms(refreshExpiryStr);
    const expiresAt = new Date(Date.now() + expiryMs);

    await this.authRepository.createRefreshToken(user.id, refreshTokenHash, expiresAt);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        employeeId: user.employeeId,
      },
    };
  }

  async refreshTokens(userId: string, incomingRefreshToken: string): Promise<{ accessToken: string; newRefreshToken: string }> {
    // TODO (Phase 3c): Implement single-use rotation and reuse detection
    throw new Error('Not implemented');
  }

  async logout(userId: string): Promise<void> {
    // TODO (Phase 3c): Invalidate / revoke refresh token in database
  }

  async getMe(userId: string): Promise<any> {
    // TODO: Fetch user profile with linked Employee data
    throw new Error('Not implemented');
  }
}
