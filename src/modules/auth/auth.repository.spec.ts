import { Test, TestingModule } from '@nestjs/testing';
import { AuthRepository } from './auth.repository';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_REFRESH_TOKEN_QUERY_LIMIT,
  DEFAULT_REFRESH_TOKEN_REUSE_RETENTION_DAYS,
  DEFAULT_REFRESH_TOKEN_PURGE_RETENTION_DAYS,
} from './auth.constants';

describe('AuthRepository', () => {
  let repository: AuthRepository;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<AuthRepository>(AuthRepository);
  });

  describe('findRefreshTokensByUserId()', () => {
    it('applies default retention window (7 days), desc order, and query limit (20)', async () => {
      const mockTokens = [{ id: 'token-1' }, { id: 'token-2' }];
      prisma.refreshToken.findMany.mockResolvedValue(mockTokens);

      const beforeCall = Date.now();
      const result = await repository.findRefreshTokensByUserId('user-uuid-1');
      const afterCall = Date.now();

      expect(result).toEqual(mockTokens);
      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-uuid-1',
          OR: [
            { revokedAt: null },
            { revokedAt: { gte: expect.any(Date) } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: DEFAULT_REFRESH_TOKEN_QUERY_LIMIT,
      });

      // Verify revokedSince matches approx 7 days ago
      const findCallArgs = prisma.refreshToken.findMany.mock.calls[0][0];
      const gteDate: Date = findCallArgs.where.OR[1].revokedAt.gte;
      const expectedCutoff =
        DEFAULT_REFRESH_TOKEN_REUSE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      expect(gteDate.getTime()).toBeGreaterThanOrEqual(beforeCall - expectedCutoff - 1000);
      expect(gteDate.getTime()).toBeLessThanOrEqual(afterCall - expectedCutoff + 1000);
    });

    it('respects custom options for limit and revokedSince cutoff', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([]);

      const customCutoff = new Date('2026-08-01T00:00:00.000Z');
      await repository.findRefreshTokensByUserId('user-uuid-1', {
        limit: 5,
        revokedSince: customCutoff,
      });

      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-uuid-1',
          OR: [
            { revokedAt: null },
            { revokedAt: { gte: customCutoff } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    });
  });

  describe('purgeExpiredOrOldRevokedTokens()', () => {
    it('calls deleteMany with expired tokens and revoked tokens older than 30 days by default', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 15 });

      const beforeCall = Date.now();
      const result = await repository.purgeExpiredOrOldRevokedTokens();
      const afterCall = Date.now();

      expect(result).toEqual({ count: 15 });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { revokedAt: { lt: expect.any(Date) } },
          ],
        },
      });

      const callArgs = prisma.refreshToken.deleteMany.mock.calls[0][0];
      const ltRevokedDate: Date = callArgs.where.OR[1].revokedAt.lt;
      const expectedCutoff =
        DEFAULT_REFRESH_TOKEN_PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      expect(ltRevokedDate.getTime()).toBeGreaterThanOrEqual(beforeCall - expectedCutoff - 1000);
      expect(ltRevokedDate.getTime()).toBeLessThanOrEqual(afterCall - expectedCutoff + 1000);
    });

    it('uses custom cutoff when provided', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      const customCutoff = new Date('2026-07-01T00:00:00.000Z');
      const result = await repository.purgeExpiredOrOldRevokedTokens(customCutoff);

      expect(result).toEqual({ count: 5 });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { revokedAt: { lt: customCutoff } },
          ],
        },
      });
    });
  });
});
