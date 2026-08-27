import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  let authService: AuthService;
  let authRepository: jest.Mocked<Partial<AuthRepository>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  let configService: jest.Mocked<Partial<ConfigService>>;

  const rawPassword = 'password123';
  let hashedPassword = '';

  beforeAll(async () => {
    hashedPassword = await bcrypt.hash(rawPassword, 10);
  });

  beforeEach(async () => {
    authRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createRefreshToken: jest.fn(),
      findRefreshTokensByUserId: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllRefreshTokensByUserId: jest.fn(),
    };

    jwtService = {
      signAsync: jest.fn(),
    };

    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test_jwt_refresh_secret';
        if (key === 'JWT_ACCESS_SECRET') return 'test_jwt_access_secret';
        throw new Error(`Missing config key: ${key}`);
      }),
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        if (key === 'JWT_ACCESS_EXPIRATION') return '15m';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: authRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  const mockUser = {
    id: 'user-uuid-1',
    email: 'admin@example.com',
    passwordHash: '',
    role: UserRole.HR_ADMIN,
    isActive: true,
    employeeId: 'emp-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('Login Flow', () => {
    const loginDto: LoginDto = {
      email: 'admin@example.com',
      password: rawPassword,
    };

    it('1. Sukses login: mengembalikan access token, refresh token, dan sanitized user', async () => {
      mockUser.passwordHash = hashedPassword;
      authRepository.findByEmail = jest.fn().mockResolvedValue(mockUser);
      jwtService.signAsync = jest
        .fn()
        .mockResolvedValueOnce('mock_access_token')
        .mockResolvedValueOnce('mock_refresh_token');
      authRepository.createRefreshToken = jest.fn().mockResolvedValue({
        id: 'rt-uuid-1',
        userId: mockUser.id,
        tokenHash: 'hashed_rt',
        expiresAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
      });

      const result = await authService.login(loginDto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock_access_token');
      expect(result.refreshToken).toBe('mock_refresh_token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        isActive: true,
        employeeId: mockUser.employeeId,
      });
      expect((result.user as any).passwordHash).toBeUndefined();
      expect(authRepository.createRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('2. Gagal: email tidak ditemukan melempar 401 Unauthorized', async () => {
      authRepository.findByEmail = jest.fn().mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      try {
        await authService.login(loginDto);
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(error.message).toBe('Email atau password tidak valid');
      }
    });

    it('3. Gagal: password salah melempar 401 Unauthorized', async () => {
      mockUser.passwordHash = hashedPassword;
      authRepository.findByEmail = jest.fn().mockResolvedValue(mockUser);

      const wrongPasswordDto: LoginDto = {
        email: 'admin@example.com',
        password: 'wrong_password',
      };

      await expect(authService.login(wrongPasswordDto)).rejects.toThrow(
        UnauthorizedException,
      );

      try {
        await authService.login(wrongPasswordDto);
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(error.message).toBe('Email atau password tidak valid');
      }
    });

    it('4. Gagal: user non-aktif (isActive = false) melempar 401 Unauthorized', async () => {
      mockUser.passwordHash = hashedPassword;
      const inactiveUser = { ...mockUser, isActive: false };
      authRepository.findByEmail = jest.fn().mockResolvedValue(inactiveUser);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      try {
        await authService.login(loginDto);
      } catch (error: any) {
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(error.message).toBe(
          'Akun Anda telah dinonaktifkan. Silakan hubungi Administrator HR.',
        );
      }
    });
  });

  describe('Refresh Tokens Flow & Reuse Detection', () => {
    const rawRefreshToken = 'incoming_valid_refresh_token';
    let hashedRefreshToken = '';

    beforeAll(async () => {
      hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);
    });

    it('1. Sukses refresh (Rotation): revoke old token, terbitkan new access & refresh token, simpan new token', async () => {
      authRepository.findById = jest.fn().mockResolvedValue(mockUser);

      const activeTokenRecord = {
        id: 'token-active-uuid',
        userId: mockUser.id,
        tokenHash: hashedRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days in future
        revokedAt: null,
        createdAt: new Date(),
      };

      authRepository.findRefreshTokensByUserId = jest
        .fn()
        .mockResolvedValue([activeTokenRecord]);
      authRepository.revokeRefreshToken = jest.fn().mockResolvedValue({
        ...activeTokenRecord,
        revokedAt: new Date(),
      });
      jwtService.signAsync = jest
        .fn()
        .mockResolvedValueOnce('new_access_token')
        .mockResolvedValueOnce('new_refresh_token');
      authRepository.createRefreshToken = jest.fn().mockResolvedValue({
        id: 'token-new-uuid',
        userId: mockUser.id,
        tokenHash: 'new_hashed_rt',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        createdAt: new Date(),
      });

      const result = await authService.refreshTokens(
        mockUser.id,
        rawRefreshToken,
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('new_access_token');
      expect(result.newRefreshToken).toBe('new_refresh_token');
      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(
        'token-active-uuid',
      );
      expect(authRepository.createRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('2. Gagal: Reuse attack terdeteksi (token sudah di-revoke) -> revoke SEMUA sesi user dan lempar 401', async () => {
      authRepository.findById = jest.fn().mockResolvedValue(mockUser);

      const alreadyRevokedToken = {
        id: 'token-revoked-uuid',
        userId: mockUser.id,
        tokenHash: hashedRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(Date.now() - 1000), // already revoked in the past
        createdAt: new Date(),
      };

      authRepository.findRefreshTokensByUserId = jest
        .fn()
        .mockResolvedValue([alreadyRevokedToken]);
      authRepository.revokeAllRefreshTokensByUserId = jest
        .fn()
        .mockResolvedValue({ count: 3 });

      await expect(
        authService.refreshTokens(mockUser.id, rawRefreshToken),
      ).rejects.toThrow(UnauthorizedException);

      expect(
        authRepository.revokeAllRefreshTokensByUserId,
      ).toHaveBeenCalledWith(mockUser.id);
      expect(authRepository.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('3. Gagal: Normal Expiration (token sudah kedaluwarsa) -> revoke HANYA token ini dan lempar 401', async () => {
      authRepository.findById = jest.fn().mockResolvedValue(mockUser);

      const expiredToken = {
        id: 'token-expired-uuid',
        userId: mockUser.id,
        tokenHash: hashedRefreshToken,
        expiresAt: new Date(Date.now() - 10000), // expired 10s ago
        revokedAt: null,
        createdAt: new Date(),
      };

      authRepository.findRefreshTokensByUserId = jest
        .fn()
        .mockResolvedValue([expiredToken]);
      authRepository.revokeRefreshToken = jest.fn().mockResolvedValue({
        ...expiredToken,
        revokedAt: new Date(),
      });

      await expect(
        authService.refreshTokens(mockUser.id, rawRefreshToken),
      ).rejects.toThrow(UnauthorizedException);

      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(
        'token-expired-uuid',
      );
      expect(
        authRepository.revokeAllRefreshTokensByUserId,
      ).not.toHaveBeenCalled();
    });

    it('4. Gagal: Token tidak ditemukan di database -> revoke SEMUA sesi user dan lempar 401', async () => {
      authRepository.findById = jest.fn().mockResolvedValue(mockUser);
      authRepository.findRefreshTokensByUserId = jest
        .fn()
        .mockResolvedValue([]);
      authRepository.revokeAllRefreshTokensByUserId = jest
        .fn()
        .mockResolvedValue({ count: 0 });

      await expect(
        authService.refreshTokens(mockUser.id, 'unrecognized_token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(
        authRepository.revokeAllRefreshTokensByUserId,
      ).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('Logout Flow', () => {
    const rawRefreshToken = 'logout_refresh_token';
    let hashedRefreshToken = '';

    beforeAll(async () => {
      hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 10);
    });

    it('1. Sukses logout dengan refresh token spesifik: me-revoke token tersebut', async () => {
      const activeToken = {
        id: 'token-to-logout-uuid',
        userId: mockUser.id,
        tokenHash: hashedRefreshToken,
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
        createdAt: new Date(),
      };

      authRepository.findRefreshTokensByUserId = jest
        .fn()
        .mockResolvedValue([activeToken]);
      authRepository.revokeRefreshToken = jest.fn().mockResolvedValue({
        ...activeToken,
        revokedAt: new Date(),
      });

      await authService.logout(mockUser.id, rawRefreshToken);

      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith(
        'token-to-logout-uuid',
      );
    });

    it('2. Sukses logout tanpa refresh token spesifik: me-revoke semua sesi user', async () => {
      authRepository.revokeAllRefreshTokensByUserId = jest
        .fn()
        .mockResolvedValue({ count: 2 });

      await authService.logout(mockUser.id);

      expect(
        authRepository.revokeAllRefreshTokensByUserId,
      ).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('GetMe Flow', () => {
    it('1. Sukses getMe: mengembalikan profile user tanpa passwordHash', async () => {
      authRepository.findById = jest.fn().mockResolvedValue(mockUser);

      const result = await authService.getMe(mockUser.id);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        isActive: mockUser.isActive,
        employeeId: mockUser.employeeId,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('2. Gagal getMe: user tidak ditemukan atau tidak aktif melempar 401', async () => {
      authRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(authService.getMe('non-existent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
