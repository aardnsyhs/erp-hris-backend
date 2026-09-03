import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DepartmentRepository } from './department.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class DepartmentService {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto) {
    const existingDepartment = await this.departmentRepository.findByCode(
      createDepartmentDto.code,
    );

    if (existingDepartment) {
      throw new ConflictException(
        `Departemen dengan kode '${createDepartmentDto.code}' sudah terdaftar`,
      );
    }

    const created = await this.departmentRepository.create(createDepartmentDto);

    await this.auditLogService.record({
      action: 'CREATE',
      entity: 'Department',
      entityId: created.id,
      after: created,
      source: 'USER',
    });

    return created;
  }

  async findAll(query: PaginationQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.departmentRepository.findAll({
        skip,
        take: limit,
        search: query.search,
      }),
      this.departmentRepository.countAll(query.search),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string) {
    const department = await this.departmentRepository.findById(id);
    if (!department) {
      throw new NotFoundException(
        `Departemen dengan ID '${id}' tidak ditemukan`,
      );
    }

    return department;
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto) {
    const department = await this.findById(id);

    if (
      updateDepartmentDto.code &&
      updateDepartmentDto.code !== department.code
    ) {
      const existingWithCode = await this.departmentRepository.findByCode(
        updateDepartmentDto.code,
      );

      if (existingWithCode && existingWithCode.id !== id) {
        throw new ConflictException(
          `Departemen dengan kode '${updateDepartmentDto.code}' sudah terdaftar`,
        );
      }
    }

    const updated = await this.departmentRepository.update(
      id,
      updateDepartmentDto,
    );

    await this.auditLogService.record({
      action: 'UPDATE',
      entity: 'Department',
      entityId: id,
      before: department,
      after: updated,
      source: 'USER',
    });

    return updated;
  }

  async remove(id: string) {
    const department = await this.findById(id);

    // 1. Validasi karyawan aktif
    const activeEmployeesCount =
      await this.departmentRepository.countActiveEmployees(id);
    if (activeEmployeesCount > 0) {
      throw new BadRequestException(
        `Tidak dapat menghapus departemen karena masih memiliki ${activeEmployeesCount} karyawan aktif`,
      );
    }

    // 2. Validasi seluruh data karyawan terkait (inactive / terminated / soft-deleted)
    const totalEmployeesCount =
      await this.departmentRepository.countTotalEmployees(id);
    if (totalEmployeesCount > 0) {
      throw new BadRequestException(
        `Tidak dapat menghapus departemen karena masih memiliki riwayat ${totalEmployeesCount} data karyawan (non-aktif/terhapus)`,
      );
    }

    // 3. Validasi riwayat penugasan posisi (position assignments)
    const positionAssignmentsCount =
      await this.departmentRepository.countPositionAssignments(id);
    if (positionAssignmentsCount > 0) {
      throw new BadRequestException(
        `Tidak dapat menghapus departemen karena masih memiliki ${positionAssignmentsCount} riwayat penugasan posisi`,
      );
    }

    // 4. Safety net: tangkap Prisma foreign key error jika terjadi konkurensi data
    try {
      await this.departmentRepository.delete(id);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'Tidak dapat menghapus departemen karena masih direferensikan oleh data lain',
        );
      }
      throw error;
    }

    await this.auditLogService.record({
      action: 'DELETE',
      entity: 'Department',
      entityId: id,
      before: department,
      source: 'USER',
    });

    return {
      message: 'Departemen berhasil dihapus',
    };
  }
}
