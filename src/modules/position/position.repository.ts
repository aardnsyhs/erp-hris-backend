import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PositionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.PositionCreateInput) {
    return this.prisma.position.create({ data });
  }

  async update(id: string, data: Prisma.PositionUpdateInput) {
    return this.prisma.position.update({
      where: { id },
      data,
    });
  }

  async findById(id: string) {
    return this.prisma.position.findUnique({
      where: { id },
    });
  }

  async findByCode(code: string) {
    return this.prisma.position.findUnique({
      where: { code },
    });
  }

  async findMany(params: { search?: string; isActive?: boolean }) {
    const where: Prisma.PositionWhereInput = {};

    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { title: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.position.findMany({
      where,
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
    });
  }
}
