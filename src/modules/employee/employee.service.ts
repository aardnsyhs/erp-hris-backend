import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeStatus, Prisma, UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { EmployeeRepository } from './employee.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
export type { AuthenticatedUser };

@Injectable()
export class EmployeeService {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    const department = await this.employeeRepository.findDepartmentById(
      createEmployeeDto.departmentId,
    );
    if (!department) {
      throw new BadRequestException(
        'Departemen tidak valid atau tidak ditemukan',
      );
    }
    if (!department.isActive) {
      throw new BadRequestException(
        `Departemen '${department.name}' telah diarsipkan dan tidak dapat menerima penambahan karyawan baru`,
      );
    }

    const existingNip = await this.employeeRepository.findByNip(
      createEmployeeDto.nip,
    );
    if (existingNip) {
      throw new ConflictException(
        `Karyawan dengan NIP '${createEmployeeDto.nip}' sudah terdaftar`,
      );
    }

    const existingEmail = await this.employeeRepository.findByEmail(
      createEmployeeDto.email,
    );
    if (existingEmail) {
      throw new ConflictException(
        `Karyawan dengan email '${createEmployeeDto.email}' sudah terdaftar`,
      );
    }

    // 2. Validasi unik email di tabel users
    const existingUser = await this.employeeRepository.findUserByEmail(
      createEmployeeDto.email,
    );
    if (existingUser) {
      throw new ConflictException(
        'Email sudah terdaftar sebagai akun pengguna',
      );
    }

    // 3. Generate password sementara & hash dengan bcrypt
    const temporaryPassword = crypto.randomBytes(5).toString('hex');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(temporaryPassword, saltRounds);

    const baseSalaryDecimal = new Prisma.Decimal(createEmployeeDto.baseSalary);
    const { role, ...employeeFields } = createEmployeeDto;

    // 4. Buat Employee dan User secara atomik dalam satu transaction
    const employee = await this.employeeRepository.createWithUser(
      {
        ...employeeFields,
        baseSalary: baseSalaryDecimal,
      },
      {
        email: createEmployeeDto.email,
        passwordHash,
        role,
      },
    );

    // 5. Kembalikan data employee bersama temporaryPassword plaintext (hanya muncul di response ini)
    await this.auditLogService.record({
      action: 'CREATE',
      entity: 'Employee',
      entityId: employee.id,
      after: employee,
      source: 'USER',
    });

    return {
      ...employee,
      temporaryPassword,
    };
  }

  async findAll(query: EmployeeQueryDto, currentUser: AuthenticatedUser) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    // 1. Role: EMPLOYEE -> Hanya dapat melihat profil miliknya sendiri
    if (currentUser.role === UserRole.EMPLOYEE) {
      if (!currentUser.employeeId) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      const ownProfile = await this.employeeRepository.findById(
        currentUser.employeeId,
      );
      const data = ownProfile
        ? [this.mapEmployeeForUser(ownProfile, currentUser)]
        : [];
      return {
        data,
        meta: {
          total: data.length,
          page: 1,
          limit,
          totalPages: data.length > 0 ? 1 : 0,
        },
      };
    }

    // 2. Role: MANAGER -> Hanya dapat melihat karyawan dalam departemen yang sama
    let effectiveDepartmentId = query.departmentId;

    if (currentUser.role === UserRole.MANAGER) {
      if (!currentUser.employeeId) {
        // Edge case: Akun Manager belum dihubungkan ke record Employee
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      const managerEmployee = await this.employeeRepository.findById(
        currentUser.employeeId,
      );
      if (!managerEmployee) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      // Kunci filter departemen ke departemen milik Manager
      effectiveDepartmentId = managerEmployee.departmentId;
    }

    // 3. Role: HR_ADMIN & Filtered Query untuk MANAGER
    const [data, total] = await Promise.all([
      this.employeeRepository.findAll({
        skip,
        take: limit,
        search: query.search,
        departmentId: effectiveDepartmentId,
        status: query.status,
      }),
      this.employeeRepository.countAll({
        search: query.search,
        departmentId: effectiveDepartmentId,
        status: query.status,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const mappedData = data.map((emp) =>
      this.mapEmployeeForUser(emp, currentUser),
    );

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findById(id: string, currentUser: AuthenticatedUser) {
    const employee = await this.employeeRepository.findByIdIncludingDeleted(id);
    if (!employee) {
      throw new NotFoundException(`Karyawan dengan ID '${id}' tidak ditemukan`);
    }

    // 1. Role: EMPLOYEE -> Hanya dapat mengakses profil sendiri
    if (currentUser.role === UserRole.EMPLOYEE) {
      if (currentUser.employeeId !== id) {
        throw new ForbiddenException(
          'Anda hanya dapat mengakses profil Anda sendiri',
        );
      }
      if (employee.deletedAt !== null) {
        throw new NotFoundException(
          `Karyawan dengan ID '${id}' tidak ditemukan`,
        );
      }
    }

    // 2. Role: MANAGER -> Hanya dapat mengakses karyawan aktif di departemen yang sama
    if (currentUser.role === UserRole.MANAGER) {
      if (!currentUser.employeeId) {
        throw new ForbiddenException(
          'Akun Manager tidak terhubung dengan data karyawan',
        );
      }

      if (employee.deletedAt !== null) {
        throw new NotFoundException(
          `Karyawan dengan ID '${id}' tidak ditemukan`,
        );
      }

      const managerEmployee = await this.employeeRepository.findById(
        currentUser.employeeId,
      );
      if (
        !managerEmployee ||
        managerEmployee.departmentId !== employee.departmentId
      ) {
        throw new ForbiddenException(
          'Anda hanya dapat melihat profil karyawan di departemen Anda sendiri',
        );
      }
    }

    // 3. HR_ADMIN dapat melihat data karyawan ACTIVE, INACTIVE, maupun TERMINATED
    return this.mapEmployeeForUser(employee, currentUser);
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Karyawan dengan ID '${id}' tidak ditemukan`);
    }

    if (updateEmployeeDto.departmentId) {
      const department = await this.employeeRepository.findDepartmentById(
        updateEmployeeDto.departmentId,
      );
      if (!department) {
        throw new BadRequestException(
          'Departemen tidak valid atau tidak ditemukan',
        );
      }
      if (!department.isActive) {
        throw new BadRequestException(
          `Departemen '${department.name}' telah diarsipkan dan tidak dapat menerima pemindahan karyawan`,
        );
      }
    }

    if (updateEmployeeDto.nip && updateEmployeeDto.nip !== employee.nip) {
      const existingNip = await this.employeeRepository.findByNip(
        updateEmployeeDto.nip,
      );
      if (existingNip && existingNip.id !== id) {
        throw new ConflictException(
          `Karyawan dengan NIP '${updateEmployeeDto.nip}' sudah terdaftar`,
        );
      }
    }

    if (updateEmployeeDto.email && updateEmployeeDto.email !== employee.email) {
      const existingEmail = await this.employeeRepository.findByEmail(
        updateEmployeeDto.email,
      );
      if (existingEmail && existingEmail.id !== id) {
        throw new ConflictException(
          `Karyawan dengan email '${updateEmployeeDto.email}' sudah terdaftar`,
        );
      }
    }

    const data: Prisma.EmployeeUncheckedUpdateInput = {
      ...updateEmployeeDto,
      ...(updateEmployeeDto.baseSalary && {
        baseSalary: new Prisma.Decimal(updateEmployeeDto.baseSalary),
      }),
    };

    const updated = await this.employeeRepository.update(id, data);

    await this.auditLogService.record({
      action: 'UPDATE',
      entity: 'Employee',
      entityId: id,
      before: employee,
      after: updated,
      source: 'USER',
    });

    return updated;
  }

  async remove(id: string) {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Karyawan dengan ID '${id}' tidak ditemukan`);
    }

    await this.employeeRepository.softDelete(id, EmployeeStatus.INACTIVE);

    await this.auditLogService.record({
      action: 'SOFT_DELETE',
      entity: 'Employee',
      entityId: id,
      before: employee,
      source: 'USER',
    });

    return {
      message: 'Karyawan berhasil dinonaktifkan',
    };
  }

  async terminate(id: string) {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Karyawan dengan ID '${id}' tidak ditemukan`);
    }

    await this.employeeRepository.terminateWithSideEffects(id);

    await this.auditLogService.record({
      action: 'TERMINATE',
      entity: 'Employee',
      entityId: id,
      before: employee,
      source: 'USER',
    });

    return {
      message: 'Karyawan berhasil diberhentikan secara permanen (TERMINATED)',
    };
  }

  async reactivate(id: string) {
    const employee =
      await this.employeeRepository.findByIdIncludingDeleted(id);
    if (!employee) {
      throw new NotFoundException(`Karyawan dengan ID '${id}' tidak ditemukan`);
    }

    if (!employee.deletedAt) {
      throw new BadRequestException('Karyawan ini sudah aktif');
    }

    if (employee.status === EmployeeStatus.TERMINATED) {
      throw new BadRequestException(
        'Karyawan yang telah diberhentikan permanen (TERMINATED) tidak dapat diaktifkan kembali',
      );
    }

    // Validasi keunikan NIP terhadap karyawan aktif lain
    const existingNip = await this.employeeRepository.findByNip(employee.nip);
    if (existingNip && existingNip.id !== id) {
      throw new ConflictException(
        `NIP '${employee.nip}' sudah digunakan oleh karyawan aktif lain`,
      );
    }

    // Validasi keunikan Email terhadap karyawan aktif lain
    const existingEmail = await this.employeeRepository.findByEmail(
      employee.email,
    );
    if (existingEmail && existingEmail.id !== id) {
      throw new ConflictException(
        `Email '${employee.email}' sudah digunakan oleh karyawan aktif lain`,
      );
    }

    const reactivated = await this.employeeRepository.reactivate(id);

    await this.auditLogService.record({
      action: 'REACTIVATE',
      entity: 'Employee',
      entityId: id,
      before: employee,
      after: reactivated,
      source: 'USER',
    });

    return {
      ...this.mapToFullView(reactivated),
      message: 'Karyawan berhasil diaktifkan kembali',
    };
  }

  // --- Whitelist View Mappers ---

  private mapToFullView(employee: any) {
    return {
      id: employee.id,
      departmentId: employee.departmentId,
      nip: employee.nip,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      jobTitle: employee.jobTitle,
      hireDate: employee.hireDate,
      baseSalary: employee.baseSalary,
      status: employee.status,
      deletedAt: employee.deletedAt,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      ...(employee.department && { department: employee.department }),
      ...(employee.user && { user: employee.user }),
    };
  }

  private mapToManagerView(employee: any) {
    return {
      id: employee.id,
      departmentId: employee.departmentId,
      nip: employee.nip,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      jobTitle: employee.jobTitle,
      hireDate: employee.hireDate,
      status: employee.status,
      deletedAt: employee.deletedAt,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
      ...(employee.department && { department: employee.department }),
      ...(employee.user && { user: employee.user }),
    };
  }

  private mapEmployeeForUser(employee: any, currentUser: AuthenticatedUser) {
    // 1. HR_ADMIN gets full financial view
    if (currentUser.role === UserRole.HR_ADMIN) {
      return this.mapToFullView(employee);
    }

    // 2. Self-access precedence: Any employee viewing own profile gets full financial view
    if (currentUser.employeeId && currentUser.employeeId === employee.id) {
      return this.mapToFullView(employee);
    }

    // 3. Manager viewing team member gets stripped non-financial view
    return this.mapToManagerView(employee);
  }
}
