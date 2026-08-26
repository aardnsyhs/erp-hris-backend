import { Controller, Post, Get, Body, Res, Req, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // TODO: Add @Public() decorator, @Throttle rate limiting
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    // TODO: 1. Call authService.login(loginDto)
    // TODO: 2. Set httpOnly, Secure, SameSite=Strict cookie for refresh_token
    // TODO: 3. Return { accessToken, user }
    throw new Error('Not implemented');
  }

  // TODO: Add @Public() decorator (or @UseGuards(JwtRefreshGuard)), @Throttle rate limiting
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    // TODO: 1. Extract refresh_token from cookie
    // TODO: 2. Call authService.refreshTokens(userId, refreshToken)
    // TODO: 3. Update httpOnly cookie with new rotated refresh token
    // TODO: 4. Return new accessToken
    throw new Error('Not implemented');
  }

  // TODO: Requires JwtAuthGuard
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    // TODO: 1. Invalidate refresh token on server
    // TODO: 2. Clear refresh_token cookie
    // TODO: 3. Return logout success message
    throw new Error('Not implemented');
  }

  // TODO: Requires JwtAuthGuard
  @Get('me')
  async getMe(@Req() req: Request): Promise<any> {
    // TODO: Return current authenticated user profile
    throw new Error('Not implemented');
  }
}
