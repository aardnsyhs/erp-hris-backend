import { Injectable } from '@nestjs/common';
import { Department, Employee, EmployeeStatus, Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithUser(
    employeeData: Prisma.EmployeeUncheckedCreateInput,
    userData: { email: string; passwordHash: string; role: UserRole },
  ): Promise<Employee> {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: employeeData,
        include: {
          department: true,
        },
      });

      await tx.user.create({
        data: {
          email: userData.email,
          passwordHash: userData.passwordHash,
          role: userData.role,
          isActive: true,
          employeeId: employee.id,
        },
      });

      return employee;
    });
  }

  async create(data: Prisma.EmployeeUncheckedCreateInput): Promise<Employee> {
    return this.prisma.employee.create({
      data,
      include: {
        department: true,
      },
    });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findAll(options: {
    skip: number;
    take: number;
    search?: string;
    departmentId?: string;
    status?: EmployeeStatus;
  }): Promise<Employee[]> {
    const where: Prisma.EmployeeWhereInput = {
      ...(options.status ? { status: options.status } : { deletedAt: null }),
      ...(options.departmentId && { departmentId: options.departmentId }),
      ...(options.search && {
        OR: [
          { fullName: { contains: options.search, mode: 'insensitive' } },
          { nip: { contains: options.search, mode: 'insensitive' } },
          { email: { contains: options.search, mode: 'insensitive' } },
          { jobTitle: { contains: options.search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.prisma.employee.findMany({
      where,
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: 'desc' },
      include: {
        department: true,
      },
    });
  }

  async countAll(options: {
    search?: string;
    departmentId?: string;
    status?: EmployeeStatus;
  }): Promise<number> {
    const where: Prisma.EmployeeWhereInput = {
      ...(options.status ? { status: options.status } : { deletedAt: null }),
      ...(options.departmentId && { departmentId: options.departmentId }),
      ...(options.search && {
        OR: [
          { fullName: { contains: options.search, mode: 'insensitive' } },
          { nip: { contains: options.search, mode: 'insensitive' } },
          { email: { contains: options.search, mode: 'insensitive' } },
          { jobTitle: { contains: options.search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.prisma.employee.count({ where });
  }

  async findById(id: string): Promise<Employee | null> {
    return this.prisma.employee.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        department: true,
      },
    });
  }

  async findByNip(nip: string): Promise<Employee | null> {
    return this.prisma.employee.findFirst({
      where: {
        nip,
        deletedAt: null,
      },
    });
  }

  async findByEmail(email: string): Promise<Employee | null> {
    return this.prisma.employee.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async findDepartmentById(departmentId: string): Promise<Department | null> {
    return this.prisma.department.findUnique({
      where: { id: departmentId },
    });
  }

  async update(
    id: string,
    data: Prisma.EmployeeUncheckedUpdateInput,
  ): Promise<Employee> {
    return this.prisma.employee.update({
      where: { id },
      data,
      include: {
        department: true,
      },
    });
  }

  async softDelete(id: string): Promise<Employee> {
    return this.prisma.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: EmployeeStatus.INACTIVE,
      },
    });
  }
}
