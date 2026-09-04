import { Injectable } from '@nestjs/common';
import { Department, EmployeeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentStatusFilter } from './dto/department-query.dto';

@Injectable()
export class DepartmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(options?: {
    search?: string;
    status?: DepartmentStatusFilter;
  }): Prisma.DepartmentWhereInput {
    const where: Prisma.DepartmentWhereInput = {};

    if (options?.status === DepartmentStatusFilter.ARCHIVED) {
      where.isActive = false;
    } else if (options?.status === DepartmentStatusFilter.ALL) {
      // no filter on isActive
    } else {
      // Default: ACTIVE
      where.isActive = true;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { code: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async create(data: {
    code: string;
    name: string;
    parentId?: string | null;
    level?: number;
  }): Promise<Department> {
    return this.prisma.department.create({
      data,
    });
  }

  async findAllForTree(options?: {
    includeArchived?: boolean;
  }): Promise<
    Array<{
      id: string;
      code: string;
      name: string;
      isActive: boolean;
      archivedAt: Date | null;
      parentId: string | null;
      level: number;
      _count: {
        employees: number;
      };
    }>
  > {
    const where: Prisma.DepartmentWhereInput = {};

    if (!options?.includeArchived) {
      where.isActive = true;
    }

    return this.prisma.department.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        archivedAt: true,
        parentId: true,
        level: true,
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
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  async findAll(options: {
    skip: number;
    take: number;
    search?: string;
    status?: DepartmentStatusFilter;
  }): Promise<Department[]> {
    const where = this.buildWhere(options);

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

  async countAll(options?: {
    search?: string;
    status?: DepartmentStatusFilter;
  }): Promise<number> {
    const where = this.buildWhere(options);
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

  async update(
    id: string,
    data: Partial<{ code: string; name: string; isActive: boolean; archivedAt: Date | null }>,
  ): Promise<Department> {
    return this.prisma.department.update({
      where: { id },
      data,
    });
  }

  async archive(id: string): Promise<Department> {
    return this.prisma.department.update({
      where: { id },
      data: {
        isActive: false,
        archivedAt: new Date(),
      },
    });
  }

  async restore(id: string): Promise<Department> {
    return this.prisma.department.update({
      where: { id },
      data: {
        isActive: true,
        archivedAt: null,
      },
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

  async countTotalEmployees(departmentId: string): Promise<number> {
    return this.prisma.employee.count({
      where: {
        departmentId,
      },
    });
  }

  async countPositionAssignments(departmentId: string): Promise<number> {
    return this.prisma.employeePositionAssignment.count({
      where: {
        departmentId,
      },
    });
  }
}
