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
import { PrismaService } from '../../prisma/prisma.service';

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
    parentId: null,
    level: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminUser = {
    userId: 'user-admin-1',
    email: 'admin@hris.local',
    role: 'HR_ADMIN' as any,
  };

  let prisma: any;
  let mockTx: any;

  beforeEach(async () => {
    auditLogService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    mockTx = {
      department: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    prisma = {
      $transaction: jest.fn(async (cb) => cb(mockTx)),
      department: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    departmentRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findAllForTree: jest.fn(),
      findAllMinimal: jest.fn().mockResolvedValue([]),
      countAll: jest.fn(),
      countChildren: jest.fn().mockResolvedValue(0),
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
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    departmentService = module.get<DepartmentService>(DepartmentService);
  });

  describe('create()', () => {
    const createDto: CreateDepartmentDto = {
      code: 'HR',
      name: 'Human Resources',
    };

    it('1. Sukses membuat root departemen baru (parentId=null, level=0)', async () => {
      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.create = jest.fn().mockResolvedValue({
        id: 'dept-uuid-2',
        ...createDto,
        parentId: null,
        level: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await departmentService.create(createDto);

      expect(result).toBeDefined();
      expect(result.code).toBe('HR');
      expect(departmentRepository.findByCode).toHaveBeenCalledWith('HR');
      expect(departmentRepository.create).toHaveBeenCalledWith({
        code: 'HR',
        name: 'Human Resources',
        parentId: null,
        level: 0,
      });
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

    it('3. Sukses membuat child departemen baru dengan parent valid (level = parent.level + 1)', async () => {
      const parentDept = {
        ...mockDepartment,
        id: 'dept-root-1',
        level: 0,
        isActive: true,
      };
      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.findById = jest.fn().mockResolvedValue(parentDept);
      departmentRepository.create = jest.fn().mockResolvedValue({
        id: 'dept-child-1',
        code: 'ENG-BE',
        name: 'Backend Engineering',
        parentId: 'dept-root-1',
        level: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await departmentService.create({
        code: 'ENG-BE',
        name: 'Backend Engineering',
        parentId: 'dept-root-1',
      });

      expect(result.level).toBe(1);
      expect(result.parentId).toBe('dept-root-1');
      expect(departmentRepository.findById).toHaveBeenCalledWith('dept-root-1');
      expect(departmentRepository.create).toHaveBeenCalledWith({
        code: 'ENG-BE',
        name: 'Backend Engineering',
        parentId: 'dept-root-1',
        level: 1,
      });
    });

    it('4. Gagal: parentId tidak ditemukan melempar NotFoundException', async () => {
      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        departmentService.create({
          code: 'ENG-FE',
          name: 'Frontend',
          parentId: 'non-existent-id',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(departmentRepository.create).not.toHaveBeenCalled();
    });

    it('5. Gagal: parentId merujuk departemen terarsip melempar BadRequestException', async () => {
      const archivedParent = {
        ...mockDepartment,
        id: 'dept-archived-1',
        isActive: false,
      };
      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.findById = jest.fn().mockResolvedValue(archivedParent);

      await expect(
        departmentService.create({
          code: 'SUB-1',
          name: 'Sub Department',
          parentId: 'dept-archived-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(departmentRepository.create).not.toHaveBeenCalled();
    });

    it('6. Gagal: parent sudah berada di level 3 sehingga child level 4 (max depth 4) melempar BadRequestException', async () => {
      const level3Parent = {
        ...mockDepartment,
        id: 'dept-lvl3-1',
        level: 3,
        isActive: true,
      };
      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.findById = jest.fn().mockResolvedValue(level3Parent);

      await expect(
        departmentService.create({
          code: 'SUB-4',
          name: 'Deep Unit',
          parentId: 'dept-lvl3-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(departmentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getTree()', () => {
    it('7. Default: hanya memuat departemen aktif dan menyusun struktur nested tree O(n)', async () => {
      const rawDepartments = [
        {
          id: 'dept-root',
          code: 'ENG',
          name: 'Engineering',
          isActive: true,
          archivedAt: null,
          parentId: null,
          level: 0,
          _count: { employees: 3 },
        },
        {
          id: 'dept-child-1',
          code: 'ENG-BE',
          name: 'Backend',
          isActive: true,
          archivedAt: null,
          parentId: 'dept-root',
          level: 1,
          _count: { employees: 2 },
        },
      ];

      departmentRepository.findAllForTree = jest
        .fn()
        .mockResolvedValue(rawDepartments);

      const tree = await departmentService.getTree();

      expect(departmentRepository.findAllForTree).toHaveBeenCalledWith({
        includeArchived: undefined,
      });
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('dept-root');
      expect(tree[0]._count.children).toBe(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe('dept-child-1');
      expect(tree[0].children[0]._count.children).toBe(0);
      expect(tree[0].children[0].children).toHaveLength(0);
    });

    it('8. Mendukung includeArchived=true untuk memuat active dan archived departments', async () => {
      const rawDepartments = [
        {
          id: 'dept-root',
          code: 'ENG',
          name: 'Engineering',
          isActive: true,
          archivedAt: null,
          parentId: null,
          level: 0,
          _count: { employees: 3 },
        },
        {
          id: 'dept-child-archived',
          code: 'ENG-LEGACY',
          name: 'Legacy Projects',
          isActive: false,
          archivedAt: new Date(),
          parentId: 'dept-root',
          level: 1,
          _count: { employees: 0 },
        },
      ];

      departmentRepository.findAllForTree = jest
        .fn()
        .mockResolvedValue(rawDepartments);

      const tree = await departmentService.getTree({ includeArchived: true });

      expect(departmentRepository.findAllForTree).toHaveBeenCalledWith({
        includeArchived: true,
      });
      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].isActive).toBe(false);
    });

    it('9. Menyusun multiple root nodes dengan benar', async () => {
      const rawDepartments = [
        {
          id: 'root-eng',
          code: 'ENG',
          name: 'Engineering',
          isActive: true,
          archivedAt: null,
          parentId: null,
          level: 0,
          _count: { employees: 3 },
        },
        {
          id: 'root-hr',
          code: 'HR',
          name: 'Human Resources',
          isActive: true,
          archivedAt: null,
          parentId: null,
          level: 0,
          _count: { employees: 1 },
        },
      ];

      departmentRepository.findAllForTree = jest
        .fn()
        .mockResolvedValue(rawDepartments);

      const tree = await departmentService.getTree();

      expect(tree).toHaveLength(2);
      expect(tree[0].id).toBe('root-eng');
      expect(tree[1].id).toBe('root-hr');
    });

    it('10. Defensive fallback: jika parentId tidak ditemukan dalam result set, tidak crash dan diperlakukan sebagai root fallback', async () => {
      const rawDepartments = [
        {
          id: 'dept-orphan',
          code: 'ORPHAN',
          name: 'Orphan Unit',
          isActive: true,
          archivedAt: null,
          parentId: 'missing-parent-id',
          level: 1,
          _count: { employees: 0 },
        },
      ];

      departmentRepository.findAllForTree = jest
        .fn()
        .mockResolvedValue(rawDepartments);

      const tree = await departmentService.getTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('dept-orphan');
      expect(tree[0].parentId).toBe('missing-parent-id');
    });

    it('11. Zero N+1: findAllForTree hanya dipanggil tepat satu kali untuk seluruh pohon', async () => {
      departmentRepository.findAllForTree = jest.fn().mockResolvedValue([]);

      await departmentService.getTree();

      expect(departmentRepository.findAllForTree).toHaveBeenCalledTimes(1);
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

  describe('Sub-Milestone 4A.2: Full Ancestor-Chain Validation in create()', () => {
    it('sukses membuat child jika parent dan seluruh leluhur berstatus aktif', async () => {
      const rootDept = { id: 'root-1', code: 'ROOT', name: 'Root', parentId: null, level: 0, isActive: true };
      const divDept = { id: 'div-1', code: 'DIV', name: 'Division', parentId: 'root-1', level: 1, isActive: true };

      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.findById = jest.fn().mockResolvedValue(divDept);
      departmentRepository.findAllMinimal = jest.fn().mockResolvedValue([rootDept, divDept]);
      departmentRepository.create = jest.fn().mockResolvedValue({
        id: 'child-1',
        code: 'CHILD',
        name: 'Child Dept',
        parentId: 'div-1',
        level: 2,
      });

      const result = await departmentService.create({
        code: 'CHILD',
        name: 'Child Dept',
        parentId: 'div-1',
      });

      expect(result.level).toBe(2);
      expect(departmentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 'div-1', level: 2 }),
      );
    });

    it('gagal membuat child jika terdapat ancestor (kakek/grandparent) yang terarsip', async () => {
      const archivedRoot = { id: 'root-1', code: 'ROOT', name: 'Root Corp', parentId: null, level: 0, isActive: false };
      const activeDiv = { id: 'div-1', code: 'DIV', name: 'Tech Div', parentId: 'root-1', level: 1, isActive: true };

      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.findById = jest.fn().mockResolvedValue(activeDiv);
      departmentRepository.findAllMinimal = jest.fn().mockResolvedValue([archivedRoot, activeDiv]);

      await expect(
        departmentService.create({
          code: 'CHILD',
          name: 'Child Dept',
          parentId: 'div-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('gagal membuat child jika rantai leluhur memiliki siklus sirkular korup', async () => {
      const nodeA = { id: 'node-a', code: 'A', name: 'Node A', parentId: 'node-b', level: 1, isActive: true };
      const nodeB = { id: 'node-b', code: 'B', name: 'Node B', parentId: 'node-a', level: 0, isActive: true };

      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.findById = jest.fn().mockResolvedValue(nodeA);
      departmentRepository.findAllMinimal = jest.fn().mockResolvedValue([nodeA, nodeB]);

      await expect(
        departmentService.create({
          code: 'CHILD',
          name: 'Child Dept',
          parentId: 'node-a',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Sub-Milestone 4A.2: Deep Descendant Guard in archive()', () => {
    it('gagal mengarsipkan departemen jika masih memiliki direct child yang aktif', async () => {
      const parentDept = { id: 'parent-1', name: 'Parent', isActive: true };
      const childDept = { id: 'child-1', name: 'Child', parentId: 'parent-1', level: 1, isActive: true };

      departmentRepository.findById = jest.fn().mockResolvedValue(parentDept);
      departmentRepository.findAllMinimal = jest.fn().mockResolvedValue([parentDept, childDept]);

      await expect(departmentService.archive('parent-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(departmentRepository.archive).not.toHaveBeenCalled();
    });

    it('gagal mengarsipkan departemen jika memiliki grandchild aktif meskipun direct child terarsip', async () => {
      const rootDept = { id: 'root-1', name: 'Root', isActive: true };
      const childDept = { id: 'child-1', name: 'Child', parentId: 'root-1', level: 1, isActive: false };
      const grandChild = { id: 'gc-1', name: 'Grandchild', parentId: 'child-1', level: 2, isActive: true };

      departmentRepository.findById = jest.fn().mockResolvedValue(rootDept);
      departmentRepository.findAllMinimal = jest.fn().mockResolvedValue([rootDept, childDept, grandChild]);

      await expect(departmentService.archive('root-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(departmentRepository.archive).not.toHaveBeenCalled();
    });

    it('sukses mengarsipkan departemen jika seluruh descendant sudah berstatus terarsip dan 0 karyawan aktif', async () => {
      const parentDept = { id: 'parent-1', name: 'Parent', isActive: true };
      const childDept = { id: 'child-1', name: 'Child', parentId: 'parent-1', level: 1, isActive: false };

      departmentRepository.findById = jest.fn().mockResolvedValue(parentDept);
      departmentRepository.findAllMinimal = jest.fn().mockResolvedValue([parentDept, childDept]);
      departmentRepository.countActiveEmployees = jest.fn().mockResolvedValue(0);
      departmentRepository.archive = jest.fn().mockResolvedValue({ ...parentDept, isActive: false });

      const result = await departmentService.archive('parent-1');

      expect(result.isActive).toBe(false);
      expect(departmentRepository.archive).toHaveBeenCalledWith('parent-1');
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ARCHIVE', entityId: 'parent-1' }),
      );
    });
  });

  describe('Sub-Milestone 4A.2: Deep Ancestor Guard in restore()', () => {
    it('gagal mengaktifkan kembali jika direct parent masih dalam status terarsip', async () => {
      const archivedChild = { id: 'child-1', name: 'Child', parentId: 'parent-1', level: 1, isActive: false };
      const archivedParent = { id: 'parent-1', name: 'Parent', parentId: null, level: 0, isActive: false };

      departmentRepository.findById = jest.fn().mockResolvedValue(archivedChild);
      departmentRepository.findAllMinimal = jest.fn().mockResolvedValue([archivedChild, archivedParent]);

      await expect(departmentService.restore('child-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(departmentRepository.restore).not.toHaveBeenCalled();
    });

    it('gagal mengaktifkan kembali jika grandparent terarsip meskipun direct parent aktif', async () => {
      const archivedChild = { id: 'child-1', name: 'Child', parentId: 'div-1', level: 2, isActive: false };
      const activeDiv = { id: 'div-1', name: 'Div', parentId: 'root-1', level: 1, isActive: true };
      const archivedRoot = { id: 'root-1', name: 'Root', parentId: null, level: 0, isActive: false };

      departmentRepository.findById = jest.fn().mockResolvedValue(archivedChild);
      departmentRepository.findAllMinimal = jest.fn().mockResolvedValue([
        archivedChild,
        activeDiv,
        archivedRoot,
      ]);

      await expect(departmentService.restore('child-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(departmentRepository.restore).not.toHaveBeenCalled();
    });

    it('sukses mengaktifkan kembali child jika seluruh leluhur berstatus aktif', async () => {
      const archivedChild = { id: 'child-1', name: 'Child', parentId: 'div-1', level: 2, isActive: false };
      const activeDiv = { id: 'div-1', name: 'Div', parentId: 'root-1', level: 1, isActive: true };
      const activeRoot = { id: 'root-1', name: 'Root', parentId: null, level: 0, isActive: true };

      departmentRepository.findById = jest.fn().mockResolvedValue(archivedChild);
      departmentRepository.findAllMinimal = jest.fn().mockResolvedValue([
        archivedChild,
        activeDiv,
        activeRoot,
      ]);
      departmentRepository.restore = jest.fn().mockResolvedValue({ ...archivedChild, isActive: true });

      const result = await departmentService.restore('child-1');

      expect(result.isActive).toBe(true);
      expect(departmentRepository.restore).toHaveBeenCalledWith('child-1');
    });

    it('sukses mengaktifkan kembali root node tanpa memvalidasi parentId', async () => {
      const archivedRoot = { id: 'root-1', name: 'Root', parentId: null, level: 0, isActive: false };

      departmentRepository.findById = jest.fn().mockResolvedValue(archivedRoot);
      departmentRepository.restore = jest.fn().mockResolvedValue({ ...archivedRoot, isActive: true });

      const result = await departmentService.restore('root-1');

      expect(result.isActive).toBe(true);
      expect(departmentRepository.findAllMinimal).not.toHaveBeenCalled();
    });
  });

  describe('Sub-Milestone 4A.2: Structural Guard in remove()', () => {
    it('gagal menghapus departemen jika masih memiliki direct child', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);
      departmentRepository.countChildren = jest.fn().mockResolvedValue(2);

      await expect(departmentService.remove('dept-uuid-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(departmentRepository.countChildren).toHaveBeenCalledWith('dept-uuid-1');
      expect(departmentRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('Sub-Milestone 4A.2: Reparenting Engine in reparentDepartment()', () => {
    const rootNode = {
      id: 'root-1',
      code: 'ROOT',
      name: 'Root Company',
      parentId: null,
      level: 0,
      isActive: true,
    };
    const divNode = {
      id: 'div-1',
      code: 'DIV',
      name: 'Division 1',
      parentId: 'root-1',
      level: 1,
      isActive: true,
    };
    const deptNode = {
      id: 'dept-1',
      code: 'DEPT',
      name: 'Department 1',
      parentId: 'div-1',
      level: 2,
      isActive: true,
    };
    const unitNode = {
      id: 'unit-1',
      code: 'UNIT',
      name: 'Unit 1',
      parentId: 'dept-1',
      level: 3,
      isActive: true,
    };
    const div2Node = {
      id: 'div-2',
      code: 'DIV2',
      name: 'Division 2',
      parentId: 'root-1',
      level: 1,
      isActive: true,
    };

    it('gagal jika target departemen tidak ditemukan melempar NotFoundException', async () => {
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode]);

      await expect(
        departmentService.reparentDepartment(
          'non-existent-id',
          { parentId: 'root-1' },
          mockAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('no-op reparenting: jika parentId sama, kembalikan target tanpa memanggil update atau auditLog', async () => {
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode]);
      mockTx.department.findUnique.mockResolvedValue(divNode);

      const result = await departmentService.reparentDepartment(
        'div-1',
        { parentId: 'root-1' },
        mockAdminUser,
      );

      expect(result).toEqual(divNode);
      expect(mockTx.department.update).not.toHaveBeenCalled();
      expect(mockTx.department.updateMany).not.toHaveBeenCalled();
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('gagal jika mencoba self-parenting (newParentId === id) melempar BadRequestException', async () => {
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode]);

      await expect(
        departmentService.reparentDepartment(
          'div-1',
          { parentId: 'div-1' },
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('gagal jika candidate parent tidak ditemukan melempar NotFoundException', async () => {
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode]);

      await expect(
        departmentService.reparentDepartment(
          'div-1',
          { parentId: 'ghost-parent-id' },
          mockAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('gagal jika target aktif dipindahkan ke candidate parent yang terarsip melempar BadRequestException', async () => {
      const archivedDiv = { ...div2Node, isActive: false };
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode, archivedDiv]);

      await expect(
        departmentService.reparentDepartment(
          'div-1',
          { parentId: 'div-2' },
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('sukses jika target terarsip dipindahkan ke parent yang aktif (target tetap terarsip)', async () => {
      const archivedDept = { ...deptNode, isActive: false };
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode, archivedDept, div2Node]);
      mockTx.department.update.mockResolvedValue({
        ...archivedDept,
        parentId: 'div-2',
        level: 2,
      });

      const result = await departmentService.reparentDepartment(
        'dept-1',
        { parentId: 'div-2' },
        mockAdminUser,
      );

      expect(result).toBeDefined();
      expect(result!.parentId).toBe('div-2');
      expect(mockTx.department.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dept-1' },
          data: { parentId: 'div-2', level: 2 },
        }),
      );
    });

    it('gagal jika siklus terdeteksi langsung: memindahkan node ke direct child-nya', async () => {
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode, deptNode]);

      await expect(
        departmentService.reparentDepartment(
          'div-1',
          { parentId: 'dept-1' }, // dept-1 is child of div-1
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('gagal jika siklus terdeteksi tidak langsung: memindahkan root ke cucunya', async () => {
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode, deptNode, unitNode]);

      await expect(
        departmentService.reparentDepartment(
          'root-1',
          { parentId: 'unit-1' }, // unit-1 is grandchild of root-1
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('gagal jika pemindahan menyebabkan subtree melampaui level 3 (max depth 4)', async () => {
      // dept-1 memiliki unit-1 di bawahnya (subtree height = 1)
      // Jika dept-1 dipindahkan ke unit lain di level 3: newTargetLevel = 3 + 1 = 4 > 3 -> reject!
      const level3Dept = { id: 'lvl3-dept', parentId: 'dept-other', level: 3, isActive: true };
      mockTx.department.findMany.mockResolvedValue([
        rootNode,
        divNode,
        deptNode,
        unitNode,
        level3Dept,
      ]);

      await expect(
        departmentService.reparentDepartment(
          'dept-1',
          { parentId: 'lvl3-dept' },
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('sukses memindahkan leaf node ke parent baru: level terupdate dan updateMany tidak dipanggil', async () => {
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode, deptNode, unitNode, div2Node]);
      const updatedLeaf = { ...unitNode, parentId: 'div-2', level: 2 };
      mockTx.department.update.mockResolvedValue(updatedLeaf);

      const result = await departmentService.reparentDepartment(
        'unit-1',
        { parentId: 'div-2', reason: 'Pindah ke Div 2' },
        mockAdminUser,
      );

      expect(result).toBeDefined();
      expect(result!.parentId).toBe('div-2');
      expect(result!.level).toBe(2);
      expect(mockTx.department.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'unit-1' },
          data: { parentId: 'div-2', level: 2 },
        }),
      );
      // unit-1 tidak memiliki descendant, jadi updateMany tidak dipanggil
      expect(mockTx.department.updateMany).not.toHaveBeenCalled();
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REPARENT_DEPARTMENT',
          entityId: 'unit-1',
          before: { parentId: 'dept-1', level: 3 },
          after: expect.objectContaining({
            parentId: 'div-2',
            level: 2,
            reason: 'Pindah ke Div 2',
            descendantCount: 0,
          }),
        }),
        mockTx,
      );
    });

    it('sukses memindahkan subtree: seluruh descendants di-update dalam SATU updateMany query (Zero N+1)', async () => {
      // Pindahkan div-1 (membawahi dept-1 dan unit-1) dari root-1 (level 0) ke div2Node (level 1)
      // oldLevel div-1 = 1, newTargetLevel = 1 + 1 = 2 -> delta = +1
      // descendants: dept-1 (old 2 -> new 3), unit-1 (old 3 -> new 4? wait, 2 + 2 = 4 > 3 akan reject!)
      // Mari pindahkan dept-1 (membawahi unit-1) dari div-1 (level 1) menjadi Root (level 0):
      // oldLevel dept-1 = 2 -> newLevel = 0, delta = -2
      // descendant unit-1: old 3 -> new 1. Max depth: 0 + 1 = 1 <= 3 (Valid!)
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode, deptNode, unitNode]);
      const updatedDept = { ...deptNode, parentId: null, level: 0 };
      mockTx.department.update.mockResolvedValue(updatedDept);
      mockTx.department.updateMany.mockResolvedValue({ count: 1 });

      const result = await departmentService.reparentDepartment(
        'dept-1',
        { parentId: null }, // Promote to root
        mockAdminUser,
      );

      expect(result).toBeDefined();
      expect(result!.parentId).toBeNull();
      expect(result!.level).toBe(0);

      // Pastikan target diupdate
      expect(mockTx.department.update).toHaveBeenCalledTimes(1);
      expect(mockTx.department.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dept-1' },
          data: { parentId: null, level: 0 },
        }),
      );

      // Pastikan descendants diupdate BUKAN per descendant, melainkan SATU updateMany query
      expect(mockTx.department.updateMany).toHaveBeenCalledTimes(1);
      expect(mockTx.department.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['unit-1'] } },
        data: { level: { increment: -2 } },
      });

      // Audit log tercatat dengan tx yang sama
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REPARENT_DEPARTMENT',
          entityId: 'dept-1',
          before: { parentId: 'div-1', level: 2 },
          after: expect.objectContaining({
            parentId: null,
            level: 0,
            descendantCount: 1,
          }),
        }),
        mockTx,
      );
    });

    it('rollback behavior: jika update database gagal di dalam transaksi, exception diteruskan ke pemanggil', async () => {
      mockTx.department.findMany.mockResolvedValue([rootNode, divNode, div2Node]);
      mockTx.department.update.mockRejectedValue(new Error('Database lock error'));

      await expect(
        departmentService.reparentDepartment(
          'div-1',
          { parentId: 'div-2' },
          mockAdminUser,
        ),
      ).rejects.toThrow('Database lock error');
    });
  });
});
