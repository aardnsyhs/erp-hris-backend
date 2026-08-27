import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from '@prisma/client';
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
      throw new UnauthorizedException(
        'Akun Anda telah dinonaktifkan. Silakan hubungi Administrator HR.',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
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
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiryStr = this.configService.get<StringValue>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );

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

    await this.authRepository.createRefreshToken(
      user.id,
      refreshTokenHash,
      expiresAt,
    );

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

  async refreshTokens(
    userId: string,
    incomingRefreshToken: string,
  ): Promise<{ accessToken: string; newRefreshToken: string }> {
    if (!incomingRefreshToken) {
      throw new UnauthorizedException('Refresh token tidak ditemukan');
    }

    // 1. Fetch user to ensure user exists and is active
    const user = await this.authRepository.findById(userId);
    if (!user || !user.isActive) {
      await this.authRepository.revokeAllRefreshTokensByUserId(userId);
      throw new UnauthorizedException(
        'Pengguna tidak aktif atau tidak ditemukan',
      );
    }

    // 2. Fetch all refresh tokens for this user
    const userTokens =
      await this.authRepository.findRefreshTokensByUserId(userId);

    // 3. Find matching token in DB using bcrypt.compare
    let matchedToken: RefreshToken | null = null;
    for (const tokenRecord of userTokens) {
      const isMatch = await bcrypt.compare(
        incomingRefreshToken,
        tokenRecord.tokenHash,
      );
      if (isMatch) {
        matchedToken = tokenRecord;
        break;
      }
    }

    // Scenario 4: Token not found in DB -> revoke all user sessions
    if (!matchedToken) {
      await this.authRepository.revokeAllRefreshTokensByUserId(userId);
      throw new UnauthorizedException('Token tidak valid');
    }

    // Scenario 1: Reuse Attack Detected (token already revoked) -> revoke all user sessions
    if (matchedToken.revokedAt !== null) {
      await this.authRepository.revokeAllRefreshTokensByUserId(userId);
      throw new UnauthorizedException(
        'Sesi telah kedaluwarsa atau token telah digunakan ulang. Silakan login kembali.',
      );
    }

    // Scenario 2: Normal Expiration (token expired) -> revoke only this token
    const now = new Date();
    if (matchedToken.expiresAt <= now) {
      await this.authRepository.revokeRefreshToken(matchedToken.id);
      throw new UnauthorizedException(
        'Sesi telah berakhir, silakan login kembali',
      );
    }

    // Scenario 3: Valid Active Token -> Rotate single-use token
    // a. Revoke current old token
    await this.authRepository.revokeRefreshToken(matchedToken.id);

    // b. Generate new Access Token
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload);

    // c. Generate new Refresh Token
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiryStr = this.configService.get<StringValue>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );

    const refreshPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const newRefreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshExpiryStr,
    });

    // d. Hash new refresh token and save to DB
    const saltRounds = 10;
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, saltRounds);
    const expiryMs = ms(refreshExpiryStr);
    const expiresAt = new Date(Date.now() + expiryMs);

    await this.authRepository.createRefreshToken(
      user.id,
      newRefreshTokenHash,
      expiresAt,
    );

    return {
      accessToken,
      newRefreshToken,
    };
  }

  async logout(userId: string, incomingRefreshToken?: string): Promise<void> {
    if (incomingRefreshToken) {
      const userTokens =
        await this.authRepository.findRefreshTokensByUserId(userId);
      for (const tokenRecord of userTokens) {
        if (tokenRecord.revokedAt === null) {
          const isMatch = await bcrypt.compare(
            incomingRefreshToken,
            tokenRecord.tokenHash,
          );
          if (isMatch) {
            await this.authRepository.revokeRefreshToken(tokenRecord.id);
            return;
          }
        }
      }
    }

    await this.authRepository.revokeAllRefreshTokensByUserId(userId);
  }

  async getMe(userId: string) {
    const user = await this.authRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Pengguna tidak ditemukan atau tidak aktif',
      );
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      employeeId: user.employeeId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
