import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
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

  /**
   * Atomic interactive transaction:
   * 1. Query existing active contracts for employee within the transaction.
   * 2. Validate no date overlap exists for ACTIVE contract.
   * 3. Insert new EmploymentContract record.
   * Prevents concurrent race conditions when two ACTIVE contracts are submitted simultaneously.
   */
  async createWithOverlapCheckTransaction(
    data: Prisma.EmploymentContractUncheckedCreateInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (data.status === ContractStatus.ACTIVE || !data.status) {
        const activeContracts = await tx.employmentContract.findMany({
          where: {
            employeeId: data.employeeId,
            status: ContractStatus.ACTIVE,
          },
        });

        const newStart = new Date(data.startDate).getTime();
        const newEnd = data.endDate ? new Date(data.endDate).getTime() : Infinity;

        const overlapping = activeContracts.find((c) => {
          const existingStart = c.startDate.getTime();
          const existingEnd = c.endDate ? c.endDate.getTime() : Infinity;
          return newStart <= existingEnd && newEnd >= existingStart;
        });

        if (overlapping) {
          throw new ConflictException(
            `Terdapat kontrak aktif '${overlapping.contractNumber}' yang overlap pada rentang tanggal tersebut`,
          );
        }
      }

      return tx.employmentContract.create({
        data,
        include: {
          document: true,
        },
      });
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

  /**
   * Atomic interactive transaction for status transitions:
   * If status transitions to ACTIVE, verifies no-overlap inside the transaction before updating.
   */
  async updateStatusWithOverlapCheckTransaction(
    id: string,
    employeeId: string,
    status: ContractStatus,
    notes?: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.employmentContract.findUnique({
        where: { id },
        include: { document: true },
      });

      if (!existing || existing.employeeId !== employeeId) {
        throw new NotFoundException(`Kontrak dengan ID '${id}' tidak ditemukan`);
      }

      if (status === ContractStatus.ACTIVE) {
        const activeContracts = await tx.employmentContract.findMany({
          where: {
            employeeId,
            status: ContractStatus.ACTIVE,
            id: { not: id },
          },
        });

        const newStart = existing.startDate.getTime();
        const newEnd = existing.endDate ? existing.endDate.getTime() : Infinity;

        const overlapping = activeContracts.find((c) => {
          const existingStart = c.startDate.getTime();
          const existingEnd = c.endDate ? c.endDate.getTime() : Infinity;
          return newStart <= existingEnd && newEnd >= existingStart;
        });

        if (overlapping) {
          throw new ConflictException(
            `Terdapat kontrak aktif '${overlapping.contractNumber}' yang overlap pada rentang tanggal tersebut`,
          );
        }
      }

      return tx.employmentContract.update({
        where: { id },
        data: {
          status,
          notes: notes !== undefined ? notes : undefined,
        },
        include: {
          document: true,
        },
      });
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
