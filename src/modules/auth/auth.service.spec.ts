import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';

describe('AuthService - Login', () => {
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
      createRefreshToken: jest.fn(),
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
    expect(authRepository.createRefreshToken).toHaveBeenCalledWith(
      mockUser.id,
      expect.any(String),
      expect.any(Date),
    );
  });

  it('2. Gagal: email tidak ditemukan melempar 401 Unauthorized', async () => {
    authRepository.findByEmail = jest.fn().mockResolvedValue(null);

    await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);

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

    await expect(authService.login(wrongPasswordDto)).rejects.toThrow(UnauthorizedException);

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

    await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedException);

    try {
      await authService.login(loginDto);
    } catch (error: any) {
      expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(error.message).toBe('Email atau password tidak valid');
    }
  });
});
