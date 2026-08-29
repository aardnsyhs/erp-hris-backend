import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentType, EmployeeDocument, Prisma } from '@prisma/client';

@Injectable()
export class EmployeeDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEmployeeById(employeeId: string) {
    return this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { department: true },
    });
  }

  async create(
    data: Prisma.EmployeeDocumentUncheckedCreateInput,
  ): Promise<EmployeeDocument> {
    return this.prisma.employeeDocument.create({
      data,
    });
  }

  async findMany(
    employeeId: string,
    params: {
      documentType?: DocumentType;
      page: number;
      limit: number;
    },
  ): Promise<{ data: EmployeeDocument[]; total: number }> {
    const { documentType, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeDocumentWhereInput = {
      employeeId,
      deletedAt: null,
      ...(documentType ? { documentType } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.employeeDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employeeDocument.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string): Promise<EmployeeDocument | null> {
    return this.prisma.employeeDocument.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async softDelete(id: string): Promise<EmployeeDocument> {
    return this.prisma.employeeDocument.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
