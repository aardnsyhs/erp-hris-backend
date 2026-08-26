import { Injectable } from '@nestjs/common';
import {
  Employee,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const nonFinancialEmployeeSelect = {
  select: {
    id: true,
    departmentId: true,
    nip: true,
    fullName: true,
    email: true,
    phone: true,
    jobTitle: true,
    hireDate: true,
    status: true,
    department: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
  },
};

const nonFinancialApproverSelect = {
  select: {
    id: true,
    nip: true,
    fullName: true,
    email: true,
    jobTitle: true,
    departmentId: true,
    department: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
  },
};

export type LeaveRequestWithDetails = Prisma.LeaveRequestGetPayload<{
  include: {
    employee: typeof nonFinancialEmployeeSelect;
    approver: typeof nonFinancialApproverSelect;
  };
}>;

@Injectable()
export class LeaveRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.LeaveRequestUncheckedCreateInput,
  ): Promise<LeaveRequest> {
    return this.prisma.leaveRequest.create({
      data,
      include: {
        employee: nonFinancialEmployeeSelect,
      },
    });
  }

  async findById(id: string): Promise<LeaveRequestWithDetails | null> {
    return this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: nonFinancialEmployeeSelect,
        approver: nonFinancialApproverSelect,
      },
    });
  }

  async findOverlappingApproved(
    employeeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<LeaveRequest | null> {
    return this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: LeaveRequestStatus.APPROVED,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
  }

  async approve(
    id: string,
    approverEmployeeId: string,
    approvedAt: Date,
  ): Promise<LeaveRequest> {
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.APPROVED,
        approvedBy: approverEmployeeId,
        approvedAt,
      },
      include: {
        employee: nonFinancialEmployeeSelect,
        approver: nonFinancialApproverSelect,
      },
    });
  }

  async reject(
    id: string,
    approverEmployeeId: string,
    approvedAt: Date,
    rejectionReason: string,
  ): Promise<LeaveRequest> {
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.REJECTED,
        approvedBy: approverEmployeeId,
        approvedAt,
        rejectionReason,
      },
      include: {
        employee: nonFinancialEmployeeSelect,
        approver: nonFinancialApproverSelect,
      },
    });
  }

  async findAll(options: {
    skip: number;
    take: number;
    employeeId?: string;
    departmentId?: string;
    status?: LeaveRequestStatus;
    leaveType?: LeaveType;
    startDate?: Date;
    endDate?: Date;
  }): Promise<LeaveRequest[]> {
    const where: Prisma.LeaveRequestWhereInput = {
      ...(options.employeeId && { employeeId: options.employeeId }),
      ...(options.status && { status: options.status }),
      ...(options.leaveType && { leaveType: options.leaveType }),
      ...(options.departmentId && {
        employee: {
          departmentId: options.departmentId,
        },
      }),
      ...((options.startDate || options.endDate) && {
        startDate: {
          ...(options.startDate && { gte: options.startDate }),
        },
        endDate: {
          ...(options.endDate && { lte: options.endDate }),
        },
      }),
    };

    return this.prisma.leaveRequest.findMany({
      where,
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: nonFinancialEmployeeSelect,
        approver: nonFinancialApproverSelect,
      },
    });
  }

  async countAll(options: {
    employeeId?: string;
    departmentId?: string;
    status?: LeaveRequestStatus;
    leaveType?: LeaveType;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    const where: Prisma.LeaveRequestWhereInput = {
      ...(options.employeeId && { employeeId: options.employeeId }),
      ...(options.status && { status: options.status }),
      ...(options.leaveType && { leaveType: options.leaveType }),
      ...(options.departmentId && {
        employee: {
          departmentId: options.departmentId,
        },
      }),
      ...((options.startDate || options.endDate) && {
        startDate: {
          ...(options.startDate && { gte: options.startDate }),
        },
        endDate: {
          ...(options.endDate && { lte: options.endDate }),
        },
      }),
    };

    return this.prisma.leaveRequest.count({ where });
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
