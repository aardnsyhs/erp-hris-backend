import { Injectable } from '@nestjs/common';
import { Attendance, AttendanceStatus, Employee, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(
    data: Prisma.AttendanceUncheckedCreateInput,
  ): Promise<Attendance> {
    return this.prisma.attendance.create({
      data,
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async checkOut(
    id: string,
    checkOutTime: Date,
    notes?: string,
  ): Promise<Attendance> {
    return this.prisma.attendance.update({
      where: { id },
      data: {
        checkOut: checkOutTime,
        ...(notes && { notes }),
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async findByEmployeeAndDate(
    employeeId: string,
    attendanceDate: Date,
  ): Promise<Attendance | null> {
    return this.prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate,
        },
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async findAll(options: {
    skip: number;
    take: number;
    employeeId?: string;
    departmentId?: string;
    status?: AttendanceStatus;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Attendance[]> {
    const where: Prisma.AttendanceWhereInput = {
      ...(options.employeeId && { employeeId: options.employeeId }),
      ...(options.status && { status: options.status }),
      ...(options.departmentId && {
        employee: {
          departmentId: options.departmentId,
        },
      }),
      ...((options.startDate || options.endDate) && {
        attendanceDate: {
          ...(options.startDate && { gte: options.startDate }),
          ...(options.endDate && { lte: options.endDate }),
        },
      }),
    };

    return this.prisma.attendance.findMany({
      where,
      skip: options.skip,
      take: options.take,
      orderBy: { attendanceDate: 'desc' },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async countAll(options: {
    employeeId?: string;
    departmentId?: string;
    status?: AttendanceStatus;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    const where: Prisma.AttendanceWhereInput = {
      ...(options.employeeId && { employeeId: options.employeeId }),
      ...(options.status && { status: options.status }),
      ...(options.departmentId && {
        employee: {
          departmentId: options.departmentId,
        },
      }),
      ...((options.startDate || options.endDate) && {
        attendanceDate: {
          ...(options.startDate && { gte: options.startDate }),
          ...(options.endDate && { lte: options.endDate }),
        },
      }),
    };

    return this.prisma.attendance.count({ where });
  }

  async findEmployeeById(employeeId: string): Promise<Employee | null> {
    return this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
      },
      include: {
        department: true,
      },
    });
  }
}
