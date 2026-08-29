import { Injectable } from '@nestjs/common';
import { ContractStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContractRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.EmploymentContractUncheckedCreateInput) {
    return this.prisma.employmentContract.create({
      data,
      include: {
        document: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.employmentContract.findUnique({
      where: { id },
      include: {
        document: true,
      },
    });
  }

  async findByContractNumber(contractNumber: string) {
    return this.prisma.employmentContract.findUnique({
      where: { contractNumber },
    });
  }

  async findActiveContractsByEmployeeId(employeeId: string) {
    return this.prisma.employmentContract.findMany({
      where: {
        employeeId,
        status: ContractStatus.ACTIVE,
      },
    });
  }

  async findOverlappingActiveContract(
    employeeId: string,
    startDate: Date,
    endDate: Date | null,
    excludeId?: string,
  ) {
    // Dua interval [A_start, A_end] dan [B_start, B_end] overlap jika:
    // A_start <= B_end AND A_end >= B_start (dengan null dianggap infinity)
    const activeContracts = await this.prisma.employmentContract.findMany({
      where: {
        employeeId,
        status: ContractStatus.ACTIVE,
        id: excludeId ? { not: excludeId } : undefined,
      },
    });

    const newStart = startDate.getTime();
    const newEnd = endDate ? endDate.getTime() : Infinity;

    return activeContracts.find((contract) => {
      const existingStart = contract.startDate.getTime();
      const existingEnd = contract.endDate
        ? contract.endDate.getTime()
        : Infinity;

      return newStart <= existingEnd && newEnd >= existingStart;
    });
  }

  async updateStatus(
    id: string,
    status: ContractStatus,
    notes?: string | null,
  ) {
    return this.prisma.employmentContract.update({
      where: { id },
      data: {
        status,
        notes: notes !== undefined ? notes : undefined,
      },
      include: {
        document: true,
      },
    });
  }

  async terminateActiveContractsForEmployee(employeeId: string) {
    return this.prisma.employmentContract.updateMany({
      where: {
        employeeId,
        status: ContractStatus.ACTIVE,
      },
      data: {
        status: ContractStatus.TERMINATED,
      },
    });
  }

  async findManyByEmployeeId(employeeId: string) {
    return this.prisma.employmentContract.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
      include: {
        document: true,
      },
    });
  }

  async findEmployeeById(employeeId: string) {
    return this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
  }

  async findDocumentById(documentId: string) {
    return this.prisma.employeeDocument.findUnique({
      where: { id: documentId },
    });
  }
}
