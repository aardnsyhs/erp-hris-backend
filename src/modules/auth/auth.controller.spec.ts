import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';

import { ThrottlerGuard } from '@nestjs/throttler';

describe('AuthController (E2E & Unit Cookie / Session Verification)', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Partial<AuthService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
      getMe: jest.fn(),
    };

    jwtService = {
      decode: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login()', () => {
    it('1. Login berhasil: menyetel httpOnly cookie dengan atribut yang sesuai', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'admin@example.com',
        role: UserRole.HR_ADMIN,
        isActive: true,
        employeeId: 'emp-uuid-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      authService.login = jest.fn().mockResolvedValue({
        accessToken: 'access_jwt',
        refreshToken: 'refresh_jwt_123',
        user: mockUser,
      });

      const res = {
        cookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.login(
        { email: 'admin@example.com', password: 'password123' },
        res,
      );

      expect(result.accessToken).toBe('access_jwt');
      expect(result.user).toEqual(mockUser);
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh_jwt_123',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });
  });

  describe('logout()', () => {
    it('2. Logout dengan refresh token valid: me-revoke sesi di DB dan menghapus cookie dengan atribut identik', async () => {
      jwtService.decode = jest.fn().mockReturnValue({ sub: 'user-uuid-1' });
      authService.logout = jest.fn().mockResolvedValue(undefined);

      const req = {
        cookies: {
          refresh_token: 'valid_refresh_token_xyz',
        },
      } as unknown as Request;

      const res = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.logout(req, res);

      expect(result).toEqual({ message: 'Logout berhasil' });
      expect(jwtService.decode).toHaveBeenCalledWith('valid_refresh_token_xyz');
      expect(authService.logout).toHaveBeenCalledWith(
        'user-uuid-1',
        'valid_refresh_token_xyz',
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
          expires: new Date(0),
        }),
      );
    });

    it('3. Logout tanpa refresh token: tetap aman (idempoten), menghapus cookie, dan mengembalikan 200 OK', async () => {
      const req = {
        cookies: {},
      } as unknown as Request;

      const res = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const result = await controller.logout(req, res);

      expect(result).toEqual({ message: 'Logout berhasil' });
      expect(authService.logout).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 0,
          expires: new Date(0),
        }),
      );
    });
  });
});
