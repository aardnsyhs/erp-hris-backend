import { Injectable } from '@nestjs/common';
import { Department, EmployeeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { code: string; name: string }): Promise<Department> {
    return this.prisma.department.create({
      data,
    });
  }

  async findAll(options: {
    skip: number;
    take: number;
    search?: string;
  }): Promise<Department[]> {
    const where: Prisma.DepartmentWhereInput = options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: 'insensitive' } },
            { code: { contains: options.search, mode: 'insensitive' } },
          ],
        }
      : {};

    return this.prisma.department.findMany({
      where,
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            employees: {
              where: {
                status: EmployeeStatus.ACTIVE,
                deletedAt: null,
              },
            },
          },
        },
      },
    });
  }

  async countAll(search?: string): Promise<number> {
    const where: Prisma.DepartmentWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    return this.prisma.department.count({ where });
  }

  async findById(id: string): Promise<Department | null> {
    return this.prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: {
              where: {
                status: EmployeeStatus.ACTIVE,
                deletedAt: null,
              },
            },
          },
        },
      },
    });
  }

  async findByCode(code: string): Promise<Department | null> {
    return this.prisma.department.findUnique({
      where: { code },
    });
  }

  async update(id: string, data: Partial<{ code: string; name: string }>): Promise<Department> {
    return this.prisma.department.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Department> {
    return this.prisma.department.delete({
      where: { id },
    });
  }

  async countActiveEmployees(departmentId: string): Promise<number> {
    return this.prisma.employee.count({
      where: {
        departmentId,
        status: EmployeeStatus.ACTIVE,
        deletedAt: null,
      },
    });
  }
}
