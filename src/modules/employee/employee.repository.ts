import { Injectable } from '@nestjs/common';
import {
  ContractStatus,
  Department,
  Employee,
  EmployeeStatus,
  MovementType,
  Prisma,
  User,
  UserRole,
} from '@prisma/client';
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
      ...(options.status ? { status: options.status } : {}),
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
      ...(options.status ? { status: options.status } : {}),
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

  async findByIdIncludingDeleted(id: string): Promise<Employee | null> {
    return this.prisma.employee.findUnique({
      where: { id },
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

  async softDelete(
    id: string,
    status: EmployeeStatus = EmployeeStatus.INACTIVE,
  ): Promise<Employee> {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status,
        },
      });

      await tx.user.updateMany({
        where: { employeeId: id },
        data: { isActive: false },
      });

      return employee;
    });
  }

  async terminateWithSideEffects(
    id: string,
    performedById?: string,
  ): Promise<Employee> {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: EmployeeStatus.TERMINATED,
        },
      });

      await tx.user.updateMany({
        where: { employeeId: id },
        data: { isActive: false },
      });

      // 1. Set active employment contracts to TERMINATED
      await tx.employmentContract.updateMany({
        where: {
          employeeId: id,
          status: ContractStatus.ACTIVE,
        },
        data: {
          status: ContractStatus.TERMINATED,
        },
      });

      // 2. Auto-close active position assignment if any
      const activeAssignment = await tx.employeePositionAssignment.findFirst({
        where: { employeeId: id, effectiveTo: null },
      });
      if (activeAssignment) {
        await tx.employeePositionAssignment.update({
          where: { id: activeAssignment.id },
          data: { effectiveTo: new Date() },
        });
      }

      // 3. Find performedById (or fallback to an existing user)
      let actorId = performedById;
      if (!actorId) {
        const user = await tx.user.findFirst({ where: { role: UserRole.HR_ADMIN } });
        actorId = user?.id || employee.id;
      }

      // 4. Create EmployeeMovementHistory entry with TERMINATION
      await tx.employeeMovementHistory.create({
        data: {
          employeeId: id,
          movementType: MovementType.TERMINATION,
          fromPositionId: activeAssignment?.positionId || null,
          fromDepartmentId: activeAssignment?.departmentId || employee.departmentId,
          effectiveDate: new Date(),
          reason: 'Karyawan diberhentikan secara permanen (TERMINATED)',
          performedById: actorId,
        },
      });

      return employee;
    });
  }

  async reactivate(id: string): Promise<Employee> {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.update({
        where: { id },
        data: {
          deletedAt: null,
          status: EmployeeStatus.ACTIVE,
        },
        include: {
          department: true,
        },
      });

      await tx.user.updateMany({
        where: { employeeId: id },
        data: { isActive: true },
      });

      return employee;
    });
  }
}
