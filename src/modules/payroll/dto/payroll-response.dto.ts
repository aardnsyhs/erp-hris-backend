import { PayrollStatus, Prisma } from '@prisma/client';

export interface EmployeeSummaryDto {
  id: string;
  nip: string;
  fullName: string;
  jobTitle: string;
  department?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface PayrollResponseDto {
  id: string;
  employeeId: string;
  employee?: EmployeeSummaryDto | null;
  periodStart: Date;
  periodEnd: Date;
  basicSalary: Prisma.Decimal;
  allowances: Prisma.Decimal;
  deductions: Prisma.Decimal;
  netSalary: Prisma.Decimal;
  status: PayrollStatus;
  paymentDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollManagerViewDto {
  id: string;
  employeeId: string;
  employee?: EmployeeSummaryDto | null;
  periodStart: Date;
  periodEnd: Date;
  status: PayrollStatus;
  paymentDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
