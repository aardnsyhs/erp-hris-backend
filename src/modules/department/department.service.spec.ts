import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DepartmentService } from './department.service';
import { DepartmentRepository } from './department.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('DepartmentService', () => {
  let departmentService: DepartmentService;
  let departmentRepository: jest.Mocked<Partial<DepartmentRepository>>;
  let auditLogService: jest.Mocked<Partial<AuditLogService>>;

  const mockDepartment = {
    id: 'dept-uuid-1',
    code: 'ENG',
    name: 'Engineering',
    isActive: true,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminUser = {
    userId: 'user-admin-1',
    email: 'admin@hris.local',
    role: 'HR_ADMIN' as any,
  };

  beforeEach(async () => {
    auditLogService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    departmentRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      countAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
      delete: jest.fn(),
      countActiveEmployees: jest.fn().mockResolvedValue(0),
      countTotalEmployees: jest.fn().mockResolvedValue(0),
      countPositionAssignments: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        { provide: DepartmentRepository, useValue: departmentRepository },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    departmentService = module.get<DepartmentService>(DepartmentService);
  });

  describe('create()', () => {
    const createDto: CreateDepartmentDto = {
      code: 'HR',
      name: 'Human Resources',
    };

    it('1. Sukses membuat departemen baru', async () => {
      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.create = jest.fn().mockResolvedValue({
        id: 'dept-uuid-2',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await departmentService.create(createDto);

      expect(result).toBeDefined();
      expect(result.code).toBe('HR');
      expect(departmentRepository.findByCode).toHaveBeenCalledWith('HR');
      expect(departmentRepository.create).toHaveBeenCalledWith(createDto);
    });

    it('2. Gagal: kode departemen sudah terdaftar melempar ConflictException', async () => {
      departmentRepository.findByCode = jest
        .fn()
        .mockResolvedValue(mockDepartment);

      await expect(
        departmentService.create({ code: 'ENG', name: 'Engineering 2' }),
      ).rejects.toThrow(ConflictException);
      expect(departmentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('3. Mengembalikan list departemen beserta metadata pagination', async () => {
      departmentRepository.findAll = jest
        .fn()
        .mockResolvedValue([mockDepartment]);
      departmentRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await departmentService.findAll({ page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(departmentRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        search: undefined,
      });
    });
  });

  describe('findById()', () => {
    it('4. Sukses mengembalikan detail departemen berdasarkan ID', async () => {
      departmentRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDepartment);

      const result = await departmentService.findById('dept-uuid-1');

      expect(result).toEqual(mockDepartment);
      expect(departmentRepository.findById).toHaveBeenCalledWith('dept-uuid-1');
    });

    it('5. Gagal: ID departemen tidak ditemukan melempar NotFoundException', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        departmentService.findById('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    const updateDto: UpdateDepartmentDto = {
      name: 'Software Engineering',
    };

    it('6. Sukses mengupdate departemen', async () => {
      departmentRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      departmentRepository.update = jest.fn().mockResolvedValue({
        ...mockDepartment,
        name: 'Software Engineering',
      });

      const result = await departmentService.update('dept-uuid-1', updateDto);

      expect(result.name).toBe('Software Engineering');
      expect(departmentRepository.update).toHaveBeenCalledWith(
        'dept-uuid-1',
        updateDto,
      );
    });

    it('7. Gagal: update kode ke kode yang sudah dipakai departemen lain melempar ConflictException', async () => {
      departmentRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      departmentRepository.findByCode = jest.fn().mockResolvedValue({
        id: 'other-dept-id',
        code: 'FIN',
        name: 'Finance',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        departmentService.update('dept-uuid-1', { code: 'FIN' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove()', () => {
    it('8. Sukses menghapus departemen jika tidak ada relasi karyawan atau posisi (count = 0)', async () => {
      departmentRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      departmentRepository.countActiveEmployees = jest
        .fn()
        .mockResolvedValue(0);
      departmentRepository.countTotalEmployees = jest
        .fn()
        .mockResolvedValue(0);
      departmentRepository.countPositionAssignments = jest
        .fn()
        .mockResolvedValue(0);
      departmentRepository.delete = jest.fn().mockResolvedValue(mockDepartment);

      const result = await departmentService.remove('dept-uuid-1');

      expect(result).toEqual({ message: 'Departemen berhasil dihapus' });
      expect(departmentRepository.delete).toHaveBeenCalledWith('dept-uuid-1');
    });

    it('9. Gagal: menolak penghapusan jika masih ada karyawan aktif melempar BadRequestException', async () => {
      departmentRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      departmentRepository.countActiveEmployees = jest
        .fn()
        .mockResolvedValue(5);

      await expect(departmentService.remove('dept-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(departmentService.remove('dept-uuid-1')).rejects.toThrow(
        /masih memiliki 5 karyawan aktif/,
      );
      expect(departmentRepository.delete).not.toHaveBeenCalled();
    });

    it('10. Gagal: menolak penghapusan jika ada karyawan inactive / terminated / soft-deleted melempar BadRequestException', async () => {
      departmentRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      departmentRepository.countActiveEmployees = jest
        .fn()
        .mockResolvedValue(0);
      departmentRepository.countTotalEmployees = jest
        .fn()
        .mockResolvedValue(3); // 3 inactive/terminated employees

      await expect(departmentService.remove('dept-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(departmentService.remove('dept-uuid-1')).rejects.toThrow(
        /masih memiliki riwayat 3 data karyawan \(non-aktif\/terhapus\)/,
      );
      expect(departmentRepository.delete).not.toHaveBeenCalled();
    });

    it('11. Gagal: menolak penghapusan jika ada riwayat penugasan posisi (position assignment) melempar BadRequestException', async () => {
      departmentRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      departmentRepository.countActiveEmployees = jest
        .fn()
        .mockResolvedValue(0);
      departmentRepository.countTotalEmployees = jest
        .fn()
        .mockResolvedValue(0);
      departmentRepository.countPositionAssignments = jest
        .fn()
        .mockResolvedValue(2); // 2 position assignments

      await expect(departmentService.remove('dept-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(departmentService.remove('dept-uuid-1')).rejects.toThrow(
        /masih memiliki 2 riwayat penugasan posisi/,
      );
      expect(departmentRepository.delete).not.toHaveBeenCalled();
    });

    it('12. Gagal: Prisma P2003 Foreign Key constraint error tertangkap dan dikonversi menjadi BadRequestException (bukan HTTP 500)', async () => {
      departmentRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDepartment);
      departmentRepository.countActiveEmployees = jest
        .fn()
        .mockResolvedValue(0);
      departmentRepository.countTotalEmployees = jest
        .fn()
        .mockResolvedValue(0);
      departmentRepository.countPositionAssignments = jest
        .fn()
        .mockResolvedValue(0);

      // Simulate unexpected concurrent foreign key insertion
      const prismaP2003Error = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed on the field: `department_id`',
        {
          code: 'P2003',
          clientVersion: '5.x',
        },
      );
      departmentRepository.delete = jest.fn().mockRejectedValue(prismaP2003Error);

      await expect(departmentService.remove('dept-uuid-1')).rejects.toThrow(
        /Tidak dapat menghapus departemen karena masih direferensikan oleh data lain/,
      );
    });
  });

  describe('archive()', () => {
    it('13. Sukses mengarsipkan departemen dengan 0 karyawan aktif', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);
      departmentRepository.countActiveEmployees = jest.fn().mockResolvedValue(0);
      const archivedMock = {
        ...mockDepartment,
        isActive: false,
        archivedAt: new Date(),
      };
      departmentRepository.archive = jest.fn().mockResolvedValue(archivedMock);

      const result = await departmentService.archive(
        'dept-uuid-1',
        { reason: 'Divisi dibubarkan' },
        mockAdminUser,
      );

      expect(result.isActive).toBe(false);
      expect(result.archivedAt).toBeDefined();
      expect(departmentRepository.archive).toHaveBeenCalledWith('dept-uuid-1');
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-admin-1',
          action: 'ARCHIVE',
          entity: 'Department',
          entityId: 'dept-uuid-1',
          after: expect.objectContaining({
            isActive: false,
            archiveReason: 'Divisi dibubarkan',
          }),
        }),
      );
    });

    it('14. Gagal: mengarsipkan departemen yang sudah berstatus diarsipkan melempar BadRequestException', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue({
        ...mockDepartment,
        isActive: false,
        archivedAt: new Date(),
      });

      await expect(
        departmentService.archive('dept-uuid-1', undefined, mockAdminUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        departmentService.archive('dept-uuid-1', undefined, mockAdminUser),
      ).rejects.toThrow(/sudah dalam status diarsipkan/);
      expect(departmentRepository.archive).not.toHaveBeenCalled();
    });

    it('15. Gagal: mengarsipkan departemen yang masih memiliki karyawan aktif melempar BadRequestException', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);
      departmentRepository.countActiveEmployees = jest.fn().mockResolvedValue(3);

      await expect(
        departmentService.archive('dept-uuid-1', undefined, mockAdminUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        departmentService.archive('dept-uuid-1', undefined, mockAdminUser),
      ).rejects.toThrow(/masih memiliki 3 karyawan aktif/);
      expect(departmentRepository.archive).not.toHaveBeenCalled();
    });
  });

  describe('restore()', () => {
    it('16. Sukses mengaktifkan kembali departemen yang diarsipkan', async () => {
      const archivedDept = {
        ...mockDepartment,
        isActive: false,
        archivedAt: new Date('2026-01-01'),
      };
      departmentRepository.findById = jest.fn().mockResolvedValue(archivedDept);
      const restoredMock = {
        ...mockDepartment,
        isActive: true,
        archivedAt: null,
      };
      departmentRepository.restore = jest.fn().mockResolvedValue(restoredMock);

      const result = await departmentService.restore(
        'dept-uuid-1',
        { reason: 'Inisiatif kembali aktif' },
        mockAdminUser,
      );

      expect(result.isActive).toBe(true);
      expect(result.archivedAt).toBeNull();
      expect(departmentRepository.restore).toHaveBeenCalledWith('dept-uuid-1');
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-admin-1',
          action: 'RESTORE',
          entity: 'Department',
          entityId: 'dept-uuid-1',
          after: expect.objectContaining({
            isActive: true,
            restoreReason: 'Inisiatif kembali aktif',
          }),
        }),
      );
    });

    it('17. Gagal: mengaktifkan kembali departemen yang sudah berstatus aktif melempar BadRequestException', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);

      await expect(
        departmentService.restore('dept-uuid-1', undefined, mockAdminUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        departmentService.restore('dept-uuid-1', undefined, mockAdminUser),
      ).rejects.toThrow(/sudah dalam status aktif/);
      expect(departmentRepository.restore).not.toHaveBeenCalled();
    });
  });

  describe('Audit Logging in DepartmentService', () => {
    it('should record CREATE audit log on create()', async () => {
      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.create = jest.fn().mockResolvedValue(mockDepartment);

      await departmentService.create({
        code: 'ENG',
        name: 'Engineering',
      });

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity: 'Department',
          entityId: mockDepartment.id,
          after: mockDepartment,
        }),
      );
    });

    it('should record UPDATE audit log on update()', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);
      const updatedMock = { ...mockDepartment, name: 'Eng & Tech' };
      departmentRepository.update = jest.fn().mockResolvedValue(updatedMock);

      await departmentService.update('dept-uuid-1', { name: 'Eng & Tech' });

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          entity: 'Department',
          entityId: 'dept-uuid-1',
          before: mockDepartment,
          after: updatedMock,
        }),
      );
    });

    it('should record DELETE audit log on remove()', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);
      departmentRepository.countActiveEmployees = jest.fn().mockResolvedValue(0);
      departmentRepository.delete = jest.fn().mockResolvedValue(mockDepartment);

      await departmentService.remove('dept-uuid-1');

      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          entity: 'Department',
          entityId: 'dept-uuid-1',
          before: mockDepartment,
        }),
      );
    });

    it('Non-blocking: create department succeeds even if audit recording returns null', async () => {
      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.create = jest.fn().mockResolvedValue(mockDepartment);
      auditLogService.record = jest.fn().mockResolvedValue(null);

      const result = await departmentService.create({
        code: 'ENG',
        name: 'Engineering',
      });

      expect(result).toEqual(mockDepartment);
    });
  });
});
