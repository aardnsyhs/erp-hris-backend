import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeEmergencyContact, Prisma } from '@prisma/client';

@Injectable()
export class EmergencyContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEmployeeById(employeeId: string) {
    return this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true },
    });
  }

  async countByEmployeeId(employeeId: string): Promise<number> {
    return this.prisma.employeeEmergencyContact.count({
      where: { employeeId },
    });
  }

  async findByEmployeeId(
    employeeId: string,
  ): Promise<EmployeeEmergencyContact[]> {
    return this.prisma.employeeEmergencyContact.findMany({
      where: { employeeId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findById(id: string): Promise<EmployeeEmergencyContact | null> {
    return this.prisma.employeeEmergencyContact.findUnique({
      where: { id },
    });
  }

  async resetPrimaryForEmployee(
    employeeId: string,
    excludeId?: string,
  ): Promise<void> {
    await this.prisma.employeeEmergencyContact.updateMany({
      where: {
        employeeId,
        isPrimary: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isPrimary: false },
    });
  }

  async create(
    data: Prisma.EmployeeEmergencyContactUncheckedCreateInput,
  ): Promise<EmployeeEmergencyContact> {
    return this.prisma.employeeEmergencyContact.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.EmployeeEmergencyContactUpdateInput,
  ): Promise<EmployeeEmergencyContact> {
    return this.prisma.employeeEmergencyContact.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<EmployeeEmergencyContact> {
    return this.prisma.employeeEmergencyContact.delete({
      where: { id },
    });
  }
}
