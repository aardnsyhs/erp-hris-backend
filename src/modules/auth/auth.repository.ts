import { Injectable } from '@nestjs/common';
import { User, RefreshToken } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_REFRESH_TOKEN_REUSE_RETENTION_DAYS,
  DEFAULT_REFRESH_TOKEN_QUERY_LIMIT,
  DEFAULT_REFRESH_TOKEN_PURGE_RETENTION_DAYS,
} from './auth.constants';

export interface FindRefreshTokensOptions {
  revokedSince?: Date;
  limit?: number;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByIdWithEmployee(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async createRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findRefreshTokensByUserId(
    userId: string,
    options?: FindRefreshTokensOptions,
  ): Promise<RefreshToken[]> {
    const retentionDays = DEFAULT_REFRESH_TOKEN_REUSE_RETENTION_DAYS;
    const defaultRevokedSince = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    const revokedSince = options?.revokedSince ?? defaultRevokedSince;
    const limit = options?.limit ?? DEFAULT_REFRESH_TOKEN_QUERY_LIMIT;

    return this.prisma.refreshToken.findMany({
      where: {
        userId,
        OR: [
          { revokedAt: null },
          { revokedAt: { gte: revokedSince } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async purgeExpiredOrOldRevokedTokens(
    retentionCutoff?: Date,
  ): Promise<{ count: number }> {
    const defaultCutoff = new Date(
      Date.now() -
        DEFAULT_REFRESH_TOKEN_PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const cutoff = retentionCutoff ?? defaultCutoff;
    const now = new Date();

    return this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { lt: cutoff } },
        ],
      },
    });
  }

  async revokeRefreshToken(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async revokeAllRefreshTokensByUserId(
    userId: string,
  ): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
