import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeStatus, Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EmployeeService, AuthenticatedUser } from './employee.service';
import { EmployeeRepository } from './employee.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('EmployeeService', () => {
  let employeeService: EmployeeService;
  let employeeRepository: jest.Mocked<Partial<EmployeeRepository>>;
  let auditLogService: jest.Mocked<Partial<AuditLogService>>;

  const mockDepartment = {
    id: 'dept-eng-uuid',
    code: 'ENG',
    name: 'Engineering',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEmployee = {
    id: 'emp-uuid-1',
    departmentId: 'dept-eng-uuid',
    nip: 'EMP001',
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '+628123456789',
    jobTitle: 'Software Engineer',
    hireDate: new Date('2024-01-01'),
    baseSalary: new Prisma.Decimal(12000000),
    status: EmployeeStatus.ACTIVE,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    department: mockDepartment,
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin-uuid',
    email: 'admin@example.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin-uuid',
  };

  const managerUser: AuthenticatedUser = {
    userId: 'user-manager-uuid',
    email: 'manager@example.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-manager-uuid',
  };

  const managerEmployee = {
    ...mockEmployee,
    id: 'emp-manager-uuid',
    departmentId: 'dept-eng-uuid',
    nip: 'EMP002',
    fullName: 'Manager Hendra',
    email: 'manager@example.com',
    jobTitle: 'Engineering Manager',
    baseSalary: new Prisma.Decimal(20000000),
  };

  const employeeUser: AuthenticatedUser = {
    userId: 'user-emp-uuid',
    email: 'john@example.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-uuid-1',
  };

  beforeEach(async () => {
    auditLogService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    employeeRepository = {
      create: jest.fn(),
      createWithUser: jest.fn(),
      findAll: jest.fn(),
      countAll: jest.fn(),
      findById: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
      findByNip: jest.fn(),
      findByEmail: jest.fn(),
      findUserByEmail: jest.fn(),
      findDepartmentById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      reactivate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: EmployeeRepository, useValue: employeeRepository },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    employeeService = module.get<EmployeeService>(EmployeeService);
  });

  describe('create()', () => {
    const createDto: CreateEmployeeDto = {
      departmentId: 'dept-eng-uuid',
      nip: 'EMP001',
      fullName: 'John Doe',
      email: 'john@example.com',
      jobTitle: 'Software Engineer',
      hireDate: new Date('2024-01-01'),
      baseSalary: '12000000',
      role: UserRole.EMPLOYEE,
    };

    it('1. Sukses membuat karyawan baru dan membuat akun login User otomatis', async () => {
      employeeRepository.findDepartmentById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      employeeRepository.findByNip = jest.fn().mockResolvedValue(null);
      employeeRepository.findByEmail = jest.fn().mockResolvedValue(null);
      employeeRepository.findUserByEmail = jest.fn().mockResolvedValue(null);
      employeeRepository.createWithUser = jest
        .fn()
        .mockResolvedValue(mockEmployee);

      const result = await employeeService.create(createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockEmployee.id);
      expect(result.temporaryPassword).toBeDefined();
      expect(typeof result.temporaryPassword).toBe('string');
      expect(result.temporaryPassword.length).toBe(10);

      // Verify that createWithUser was called with employee data and hashed user data
      expect(employeeRepository.createWithUser).toHaveBeenCalledWith(
        expect.objectContaining({
          nip: 'EMP001',
          email: 'john@example.com',
          baseSalary: expect.any(Prisma.Decimal),
        }),
        expect.objectContaining({
          email: 'john@example.com',
          role: UserRole.EMPLOYEE,
          passwordHash: expect.any(String),
        }),
      );

      // Verify that temporaryPassword matches the generated passwordHash via bcrypt
      const passedUser = (employeeRepository.createWithUser as jest.Mock).mock
        .calls[0][1];
      const bcryptMatch = await bcrypt.compare(
        result.temporaryPassword,
        passedUser.passwordHash,
      );
      expect(bcryptMatch).toBe(true);
    });

    it('2. Gagal: Departemen tidak ditemukan melempar BadRequestException', async () => {
      employeeRepository.findDepartmentById = jest.fn().mockResolvedValue(null);

      await expect(employeeService.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(employeeRepository.createWithUser).not.toHaveBeenCalled();
    });

    it('3. Gagal: NIP duplikat melempar ConflictException', async () => {
      employeeRepository.findDepartmentById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      employeeRepository.findByNip = jest.fn().mockResolvedValue(mockEmployee);

      await expect(employeeService.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(employeeRepository.createWithUser).not.toHaveBeenCalled();
    });

    it('4. Gagal: Email duplikat di tabel employees melempar ConflictException', async () => {
      employeeRepository.findDepartmentById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      employeeRepository.findByNip = jest.fn().mockResolvedValue(null);
      employeeRepository.findByEmail = jest
        .fn()
        .mockResolvedValue(mockEmployee);

      await expect(employeeService.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(employeeRepository.createWithUser).not.toHaveBeenCalled();
    });

    it('5. Gagal: Email sudah terdaftar di tabel users melempar ConflictException', async () => {
      employeeRepository.findDepartmentById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      employeeRepository.findByNip = jest.fn().mockResolvedValue(null);
      employeeRepository.findByEmail = jest.fn().mockResolvedValue(null);
      employeeRepository.findUserByEmail = jest
        .fn()
        .mockResolvedValue({ id: 'user-uuid', email: 'john@example.com' } as any);

      await expect(employeeService.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(employeeRepository.createWithUser).not.toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('5. HR_ADMIN: dapat melihat seluruh karyawan dengan baseSalary lengkap', async () => {
      employeeRepository.findAll = jest.fn().mockResolvedValue([mockEmployee]);
      employeeRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await employeeService.findAll(
        { page: 1, limit: 10 },
        hrAdminUser,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].baseSalary).toBeDefined();
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(employeeRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        search: undefined,
        departmentId: undefined,
        status: undefined,
      });
    });

    it('6. HR_ADMIN: saat data total = 0, mengembalikan totalPages = 0', async () => {
      employeeRepository.findAll = jest.fn().mockResolvedValue([]);
      employeeRepository.countAll = jest.fn().mockResolvedValue(0);

      const result = await employeeService.findAll(
        { page: 1, limit: 10 },
        hrAdminUser,
      );

      expect(result.data).toHaveLength(0);
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });

    it('7. MANAGER: filter dibatasi ke departemen sendiri & baseSalary anggota tim di-strip', async () => {
      employeeRepository.findById = jest
        .fn()
        .mockResolvedValue(managerEmployee);
      employeeRepository.findAll = jest
        .fn()
        .mockResolvedValue([mockEmployee, managerEmployee]);
      employeeRepository.countAll = jest.fn().mockResolvedValue(2);

      const result = await employeeService.findAll(
        { page: 1, limit: 10 },
        managerUser,
      );

      expect(result.data).toHaveLength(2);
      // Team member baseSalary is stripped
      expect((result.data[0] as any).baseSalary).toBeUndefined();
      // Manager's own baseSalary is retained
      expect((result.data[1] as any).baseSalary).toBeDefined();

      expect(employeeRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-eng-uuid',
        }),
      );
    });

    it('8. MANAGER tanpa employeeId: mengembalikan list kosong', async () => {
      const managerWithoutEmp: AuthenticatedUser = {
        ...managerUser,
        employeeId: null,
      };

      const result = await employeeService.findAll(
        { page: 1, limit: 10 },
        managerWithoutEmp,
      );

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
      expect(employeeRepository.findAll).not.toHaveBeenCalled();
    });

    it('9. EMPLOYEE: hanya mengembalikan data profil sendiri dengan baseSalary utuh', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(mockEmployee);

      const result = await employeeService.findAll(
        { page: 1, limit: 10 },
        employeeUser,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('emp-uuid-1');
      expect(result.data[0].baseSalary).toBeDefined();
      expect(result.meta.total).toBe(1);
      expect(employeeRepository.findAll).not.toHaveBeenCalled();
    });

    it('10. HR_ADMIN: filter status=INACTIVE memanggil repository dengan status=INACTIVE untuk mengembalikan karyawan soft-deleted', async () => {
      const inactiveEmployee = {
        ...mockEmployee,
        status: EmployeeStatus.INACTIVE,
        deletedAt: new Date(),
      };

      employeeRepository.findAll = jest
        .fn()
        .mockResolvedValue([inactiveEmployee]);
      employeeRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await employeeService.findAll(
        { page: 1, limit: 10, status: EmployeeStatus.INACTIVE },
        hrAdminUser,
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(EmployeeStatus.INACTIVE);
      expect(employeeRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        search: undefined,
        departmentId: undefined,
        status: EmployeeStatus.INACTIVE,
      });
    });

    it('11. HR_ADMIN: query tanpa filter status eksplisit meneruskan status: undefined sehingga mengecualikan soft-deleted by default', async () => {
      employeeRepository.findAll = jest.fn().mockResolvedValue([mockEmployee]);
      employeeRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await employeeService.findAll(
        { page: 1, limit: 10 },
        hrAdminUser,
      );

      expect(result.data).toHaveLength(1);
      expect(employeeRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        search: undefined,
        departmentId: undefined,
        status: undefined,
      });
    });
  });

  describe('findById()', () => {
    it('10. HR_ADMIN: berhasil melihat karyawan ACTIVE dengan baseSalary lengkap', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(mockEmployee);

      const result = await employeeService.findById('emp-uuid-1', hrAdminUser);

      expect(result.id).toBe('emp-uuid-1');
      expect(result.status).toBe(EmployeeStatus.ACTIVE);
      expect((result as any).baseSalary).toBeDefined();
    });

    it('10a. HR_ADMIN: berhasil melihat karyawan INACTIVE dengan deletedAt terisi dan TIDAK 404', async () => {
      const inactiveEmployee = {
        ...mockEmployee,
        status: EmployeeStatus.INACTIVE,
        deletedAt: new Date('2026-08-20T10:00:00Z'),
      };
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(inactiveEmployee);

      const result = await employeeService.findById('emp-uuid-1', hrAdminUser);

      expect(result.id).toBe('emp-uuid-1');
      expect(result.status).toBe(EmployeeStatus.INACTIVE);
      expect(result.deletedAt).toBeDefined();
      expect((result as any).baseSalary).toBeDefined();
    });

    it('10b. HR_ADMIN: berhasil melihat karyawan TERMINATED dengan deletedAt terisi dan TIDAK 404', async () => {
      const terminatedEmployee = {
        ...mockEmployee,
        status: EmployeeStatus.TERMINATED,
        deletedAt: new Date('2026-08-25T10:00:00Z'),
      };
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(terminatedEmployee);

      const result = await employeeService.findById('emp-uuid-1', hrAdminUser);

      expect(result.id).toBe('emp-uuid-1');
      expect(result.status).toBe(EmployeeStatus.TERMINATED);
      expect(result.deletedAt).toBeDefined();
    });

    it('11. MANAGER: berhasil melihat anggota tim aktif di departemen yang sama, TAPI baseSalary di-strip', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(mockEmployee); // target employee (ACTIVE)
      employeeRepository.findById = jest
        .fn()
        .mockResolvedValue(managerEmployee); // manager employee

      const result = await employeeService.findById('emp-uuid-1', managerUser);

      expect(result.id).toBe('emp-uuid-1');
      expect((result as any).baseSalary).toBeUndefined();
    });

    it('11a. MANAGER: ditolak (NotFoundException) saat mencoba melihat anggota tim yang sudah soft-deleted (INACTIVE/TERMINATED)', async () => {
      const softDeletedEmployee = {
        ...mockEmployee,
        status: EmployeeStatus.INACTIVE,
        deletedAt: new Date(),
      };
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(softDeletedEmployee);

      await expect(
        employeeService.findById('emp-uuid-1', managerUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('12. MANAGER: berhasil melihat profil miliknya sendiri dengan baseSalary utuh', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(managerEmployee); // target employee (self)
      employeeRepository.findById = jest
        .fn()
        .mockResolvedValue(managerEmployee); // manager employee

      const result = await employeeService.findById('emp-manager-uuid', managerUser);

      expect(result.id).toBe('emp-manager-uuid');
      expect((result as any).baseSalary).toBeDefined();
    });

    it('13. MANAGER: ditolak (ForbiddenException) saat mencoba melihat karyawan di departemen lain', async () => {
      const otherDeptEmployee = {
        ...mockEmployee,
        id: 'emp-hr-uuid',
        departmentId: 'dept-hr-uuid',
      };

      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(otherDeptEmployee); // target employee in HR
      employeeRepository.findById = jest
        .fn()
        .mockResolvedValue(managerEmployee); // manager in ENG

      await expect(
        employeeService.findById('emp-hr-uuid', managerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('14. EMPLOYEE: berhasil melihat profil sendiri dengan baseSalary utuh', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(mockEmployee);

      const result = await employeeService.findById('emp-uuid-1', employeeUser);

      expect(result.id).toBe('emp-uuid-1');
      expect((result as any).baseSalary).toBeDefined();
    });

    it('15. EMPLOYEE: ditolak (ForbiddenException) saat mencoba melihat profil orang lain', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(mockEmployee);

      await expect(
        employeeService.findById('emp-other-uuid', employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('15a. EMPLOYEE: ditolak (NotFoundException) jika profil sendiri sudah di-soft-delete', async () => {
      const deletedSelf = {
        ...mockEmployee,
        status: EmployeeStatus.INACTIVE,
        deletedAt: new Date(),
      };
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(deletedSelf);

      await expect(
        employeeService.findById('emp-uuid-1', employeeUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('16. Karyawan tidak ditemukan melempar NotFoundException (404)', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(null);

      await expect(
        employeeService.findById('non-existent-id', hrAdminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    const updateDto: UpdateEmployeeDto = {
      fullName: 'John Doe Updated',
      baseSalary: '15000000',
    };

    it('17. Sukses update karyawan', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(mockEmployee);
      employeeRepository.update = jest.fn().mockResolvedValue({
        ...mockEmployee,
        fullName: 'John Doe Updated',
        baseSalary: new Prisma.Decimal(15000000),
      });

      const result = await employeeService.update('emp-uuid-1', updateDto);

      expect(result.fullName).toBe('John Doe Updated');
      expect(employeeRepository.update).toHaveBeenCalledWith(
        'emp-uuid-1',
        expect.objectContaining({
          fullName: 'John Doe Updated',
          baseSalary: expect.any(Prisma.Decimal),
        }),
      );
    });

    it('18. Gagal: update departmentId ke departemen yang tidak ada melempar BadRequestException', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(mockEmployee);
      employeeRepository.findDepartmentById = jest.fn().mockResolvedValue(null);

      await expect(
        employeeService.update('emp-uuid-1', {
          departmentId: 'invalid-dept-uuid',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove()', () => {
    it('19. Sukses soft-delete karyawan', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(mockEmployee);
      employeeRepository.softDelete = jest.fn().mockResolvedValue({
        ...mockEmployee,
        status: EmployeeStatus.INACTIVE,
        deletedAt: new Date(),
      });

      const result = await employeeService.remove('emp-uuid-1');

      expect(result).toEqual({ message: 'Karyawan berhasil dinonaktifkan' });
      expect(employeeRepository.softDelete).toHaveBeenCalledWith(
        'emp-uuid-1',
        EmployeeStatus.INACTIVE,
      );
    });

    it('20. Gagal: menghapus karyawan yang tidak ditemukan melempar NotFoundException', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(employeeService.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(employeeRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('terminate()', () => {
    it('21. Sukses memberhentikan permanen karyawan (softDelete dengan status TERMINATED)', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(mockEmployee);
      employeeRepository.softDelete = jest.fn().mockResolvedValue({
        ...mockEmployee,
        status: EmployeeStatus.TERMINATED,
        deletedAt: new Date(),
      });

      const result = await employeeService.terminate('emp-uuid-1');

      expect(result).toEqual({
        message: 'Karyawan berhasil diberhentikan secara permanen (TERMINATED)',
      });
      expect(employeeRepository.softDelete).toHaveBeenCalledWith(
        'emp-uuid-1',
        EmployeeStatus.TERMINATED,
      );
    });

    it('22. Gagal: terminate karyawan yang tidak ditemukan melempar NotFoundException', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        employeeService.terminate('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
      expect(employeeRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('reactivate()', () => {
    const inactiveEmployee = {
      ...mockEmployee,
      status: EmployeeStatus.INACTIVE,
      deletedAt: new Date('2024-01-01'),
    };

    const terminatedEmployee = {
      ...mockEmployee,
      status: EmployeeStatus.TERMINATED,
      deletedAt: new Date('2024-01-01'),
    };

    it('23. Sukses reaktivasi karyawan yang soft-deleted INACTIVE (status ACTIVE, deletedAt null)', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(inactiveEmployee);
      employeeRepository.findByNip = jest.fn().mockResolvedValue(null);
      employeeRepository.findByEmail = jest.fn().mockResolvedValue(null);
      employeeRepository.reactivate = jest.fn().mockResolvedValue({
        ...mockEmployee,
        status: EmployeeStatus.ACTIVE,
        deletedAt: null,
      });

      const result = await employeeService.reactivate('emp-uuid-1');

      expect(result.id).toBe('emp-uuid-1');
      expect(result.message).toBe('Karyawan berhasil diaktifkan kembali');
      expect(employeeRepository.reactivate).toHaveBeenCalledWith('emp-uuid-1');
    });

    it('24. Gagal: reaktivasi karyawan dengan status TERMINATED melempar BadRequestException', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(terminatedEmployee);

      await expect(employeeService.reactivate('emp-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
      try {
        await employeeService.reactivate('emp-uuid-1');
      } catch (err: any) {
        expect(err.message).toBe(
          'Karyawan yang telah diberhentikan permanen (TERMINATED) tidak dapat diaktifkan kembali',
        );
      }
      expect(employeeRepository.reactivate).not.toHaveBeenCalled();
    });

    it('25. Gagal: reaktivasi ID yang tidak ditemukan melempar NotFoundException', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(null);

      await expect(
        employeeService.reactivate('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
      expect(employeeRepository.reactivate).not.toHaveBeenCalled();
    });

    it('26. Gagal: reaktivasi karyawan yang belum pernah di-soft-delete (sudah aktif) melempar BadRequestException', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(mockEmployee); // mockEmployee has deletedAt: null

      await expect(employeeService.reactivate('emp-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(employeeRepository.reactivate).not.toHaveBeenCalled();
    });

    it('27. Gagal: NIP bentrok dengan karyawan aktif lain melempar ConflictException', async () => {
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(inactiveEmployee);
      employeeRepository.findByNip = jest
        .fn()
        .mockResolvedValue({ ...mockEmployee, id: 'other-emp-uuid' });

      await expect(employeeService.reactivate('emp-uuid-1')).rejects.toThrow(
        ConflictException,
      );
      expect(employeeRepository.reactivate).not.toHaveBeenCalled();
    });
  });

  describe('Audit Logging in EmployeeService', () => {
    it('should record CREATE audit log when employee is created', async () => {
      employeeRepository.findDepartmentById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      employeeRepository.findByNip = jest.fn().mockResolvedValue(null);
      employeeRepository.findByEmail = jest.fn().mockResolvedValue(null);
      employeeRepository.findUserByEmail = jest.fn().mockResolvedValue(null);
      employeeRepository.createWithUser = jest
        .fn()
        .mockResolvedValue(mockEmployee);

      await employeeService.create({
        departmentId: 'dept-eng-uuid',
        nip: 'EMP001',
        fullName: 'John Doe',
        email: 'john@example.com',
        jobTitle: 'Software Engineer',
        hireDate: new Date('2024-01-01'),
        baseSalary: '12000000',
        role: UserRole.EMPLOYEE,
      });

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity: 'Employee',
          entityId: mockEmployee.id,
        }),
      );
    });

    it('should record UPDATE audit log when employee is updated', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(mockEmployee);
      const updatedMock = { ...mockEmployee, fullName: 'John Updated' };
      employeeRepository.update = jest.fn().mockResolvedValue(updatedMock);

      await employeeService.update('emp-uuid-1', { fullName: 'John Updated' });

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          entity: 'Employee',
          entityId: 'emp-uuid-1',
          before: mockEmployee,
          after: updatedMock,
        }),
      );
    });

    it('should record SOFT_DELETE audit log on remove()', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(mockEmployee);
      employeeRepository.softDelete = jest.fn().mockResolvedValue(mockEmployee);

      await employeeService.remove('emp-uuid-1');

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SOFT_DELETE',
          entity: 'Employee',
          entityId: 'emp-uuid-1',
          before: mockEmployee,
        }),
      );
    });

    it('should record TERMINATE audit log on terminate()', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(mockEmployee);
      employeeRepository.softDelete = jest.fn().mockResolvedValue(mockEmployee);

      await employeeService.terminate('emp-uuid-1');

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TERMINATE',
          entity: 'Employee',
          entityId: 'emp-uuid-1',
          before: mockEmployee,
        }),
      );
    });

    it('should record REACTIVATE audit log on reactivate()', async () => {
      const inactiveEmp = {
        ...mockEmployee,
        status: EmployeeStatus.INACTIVE,
        deletedAt: new Date(),
      };
      employeeRepository.findByIdIncludingDeleted = jest
        .fn()
        .mockResolvedValue(inactiveEmp);
      employeeRepository.findByNip = jest.fn().mockResolvedValue(null);
      employeeRepository.findByEmail = jest.fn().mockResolvedValue(null);
      employeeRepository.reactivate = jest.fn().mockResolvedValue(mockEmployee);

      await employeeService.reactivate('emp-uuid-1');

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REACTIVATE',
          entity: 'Employee',
          entityId: 'emp-uuid-1',
          before: inactiveEmp,
          after: mockEmployee,
        }),
      );
    });

    it('Non-blocking: update employee succeeds even if audit recording returns null', async () => {
      employeeRepository.findById = jest.fn().mockResolvedValue(mockEmployee);
      employeeRepository.update = jest.fn().mockResolvedValue(mockEmployee);
      auditLogService.record = jest.fn().mockResolvedValue(null);

      const result = await employeeService.update('emp-uuid-1', {
        fullName: 'New Name',
      });
      expect(result).toEqual(mockEmployee);
    });
  });
});
