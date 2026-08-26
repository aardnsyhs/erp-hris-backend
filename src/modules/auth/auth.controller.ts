import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import ms from 'ms';
import type { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login pengguna (Rate limited: max 5 requests / minute)',
    description:
      'Validasi kredensial pengguna, mengembalikan access token JWT dan menyetel rotating refresh token via httpOnly cookie.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login berhasil',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Email atau password salah / Akun tidak aktif',
  })
  @ApiResponse({
    status: 429,
    description: 'Terlalu banyak percobaan login (Rate limit exceeded)',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { accessToken, refreshToken, user } =
      await this.authService.login(loginDto);

    const refreshExpiryStr = this.configService.get<StringValue>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );
    const maxAge = ms(refreshExpiryStr);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge,
    });

    return {
      accessToken,
      user,
    };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Memperbarui access token dengan single-use refresh token rotation dari cookie refresh_token. Mendeteksi reuse attack.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token berhasil dirotasi',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description:
      'Refresh token tidak valid, kedaluwarsa, atau reuse attack terdeteksi',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const user = req.user as {
      userId: string;
      email: string;
      role: string;
      refreshToken: string;
    };
    const { accessToken, newRefreshToken } =
      await this.authService.refreshTokens(user.userId, user.refreshToken);

    const refreshExpiryStr = this.configService.get<StringValue>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );
    const maxAge = ms(refreshExpiryStr);

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge,
    });

    return { accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout pengguna',
    description:
      'Mencabut session refresh token di database dan menghapus cookie refresh_token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout berhasil',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logout berhasil' },
      },
    },
  })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = req?.cookies?.refresh_token;
    if (refreshToken) {
      try {
        const payload = this.jwtService.decode(refreshToken);
        if (payload?.sub) {
          await this.authService.logout(payload.sub, refreshToken);
        }
      } catch {
        // Silently continue clearing cookie
      }
    }

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Logout berhasil' };
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Profil pengguna yang sedang login',
    description:
      'Mengembalikan data pengguna terotentikasi berdasarkan JWT Access Token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profil berhasil diambil',
  })
  @ApiResponse({
    status: 401,
    description: 'Token tidak valid atau tidak disertakan',
  })
  async getMe(@CurrentUser() currentUser: { userId: string }): Promise<any> {
    return this.authService.getMe(currentUser.userId);
  }
}
