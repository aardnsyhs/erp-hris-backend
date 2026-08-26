import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import ms from 'ms';
import type { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { accessToken, refreshToken, user } = await this.authService.login(loginDto);

    const refreshExpiryStr = this.configService.get<StringValue>('JWT_REFRESH_EXPIRATION', '7d');
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
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const user = req.user as { userId: string; email: string; role: string; refreshToken: string };
    const { accessToken, newRefreshToken } = await this.authService.refreshTokens(
      user.userId,
      user.refreshToken,
    );

    const refreshExpiryStr = this.configService.get<StringValue>('JWT_REFRESH_EXPIRATION', '7d');
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
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = req?.cookies?.refresh_token;
    if (refreshToken) {
      try {
        const payload = this.jwtService.decode(refreshToken) as { sub?: string } | null;
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

  // TODO: Protected getMe endpoint
  @Get('me')
  async getMe(@Req() req: Request): Promise<any> {
    throw new Error('Not implemented');
  }
}
