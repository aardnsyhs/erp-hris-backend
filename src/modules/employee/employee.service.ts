import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { EmployeeRepository } from './employee.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
  employeeId?: string | null;
}

@Injectable()
export class EmployeeService {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    const department = await this.employeeRepository.findDepartmentById(
      createEmployeeDto.departmentId,
    );
    if (!department) {
      throw new BadRequestException('Departemen tidak valid atau tidak ditemukan');
    }

    const existingNip = await this.employeeRepository.findByNip(createEmployeeDto.nip);
    if (existingNip) {
      throw new ConflictException(
        `Karyawan dengan NIP '${createEmployeeDto.nip}' sudah terdaftar`,
      );
    }

    const existingEmail = await this.employeeRepository.findByEmail(createEmployeeDto.email);
    if (existingEmail) {
      throw new ConflictException(
        `Karyawan dengan email '${createEmployeeDto.email}' sudah terdaftar`,
      );
    }

    const baseSalaryDecimal = new Prisma.Decimal(createEmployeeDto.baseSalary);

    return this.employeeRepository.create({
      ...createEmployeeDto,
      baseSalary: baseSalaryDecimal,
    });
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

      const ownProfile = await this.employeeRepository.findById(currentUser.employeeId);
      const data = ownProfile ? [ownProfile] : [];
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

      const managerEmployee = await this.employeeRepository.findById(currentUser.employeeId);
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

  async findById(id: string, currentUser: AuthenticatedUser) {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Karyawan dengan ID '${id}' tidak ditemukan`);
    }

    // 1. Role: EMPLOYEE -> Hanya dapat mengakses profil sendiri
    if (currentUser.role === UserRole.EMPLOYEE) {
      if (currentUser.employeeId !== id) {
        throw new ForbiddenException('Anda hanya dapat mengakses profil Anda sendiri');
      }
    }

    // 2. Role: MANAGER -> Hanya dapat mengakses karyawan di departemen yang sama
    if (currentUser.role === UserRole.MANAGER) {
      if (!currentUser.employeeId) {
        throw new ForbiddenException('Akun Manager tidak terhubung dengan data karyawan');
      }

      const managerEmployee = await this.employeeRepository.findById(currentUser.employeeId);
      if (!managerEmployee || managerEmployee.departmentId !== employee.departmentId) {
        throw new ForbiddenException(
          'Anda hanya dapat melihat profil karyawan di departemen Anda sendiri',
        );
      }
    }

    // 3. Role: HR_ADMIN -> Akses penuh
    return employee;
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
        throw new BadRequestException('Departemen tidak valid atau tidak ditemukan');
      }
    }

    if (updateEmployeeDto.nip && updateEmployeeDto.nip !== employee.nip) {
      const existingNip = await this.employeeRepository.findByNip(updateEmployeeDto.nip);
      if (existingNip && existingNip.id !== id) {
        throw new ConflictException(
          `Karyawan dengan NIP '${updateEmployeeDto.nip}' sudah terdaftar`,
        );
      }
    }

    if (updateEmployeeDto.email && updateEmployeeDto.email !== employee.email) {
      const existingEmail = await this.employeeRepository.findByEmail(updateEmployeeDto.email);
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

    return this.employeeRepository.update(id, data);
  }

  async remove(id: string) {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException(`Karyawan dengan ID '${id}' tidak ditemukan`);
    }

    await this.employeeRepository.softDelete(id);

    return {
      message: 'Karyawan berhasil dinonaktifkan',
    };
  }
}
