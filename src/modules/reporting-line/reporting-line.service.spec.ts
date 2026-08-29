import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ReportingLineService } from './reporting-line.service';
import { ReportingLineRepository } from './reporting-line.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('ReportingLineService', () => {
  let service: ReportingLineService;
  let repository: Record<keyof ReportingLineRepository, jest.Mock>;
  let auditLogService: Record<keyof AuditLogService, jest.Mock>;

  const mockSubordinate = {
    id: 'emp-1',
    nip: 'EMP001',
    fullName: 'Subordinate Employee',
    departmentId: 'dept-1',
    deletedAt: null,
  };

  const mockManager = {
    id: 'emp-mgr-1',
    nip: 'MGR001',
    fullName: 'Engineering Manager',
    jobTitle: 'Engineering Manager',
    email: 'mgr1@company.com',
    departmentId: 'dept-1',
    deletedAt: null,
  };

  const mockReportingLine = {
    id: 'rep-1',
    employeeId: 'emp-1',
    managerId: 'emp-mgr-1',
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
    isPrimary: true,
    manager: mockManager,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@company.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin',
  };

  const employeeUser: AuthenticatedUser = {
    userId: 'user-emp-1',
    email: 'emp1@company.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-1',
  };

  const otherEmployeeUser: AuthenticatedUser = {
    userId: 'user-emp-2',
    email: 'emp2@company.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-2',
  };

  const managerSameDeptUser: AuthenticatedUser = {
    userId: 'user-mgr-1',
    email: 'mgr1@company.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-mgr-1',
  };

  const managerOtherDeptUser: AuthenticatedUser = {
    userId: 'user-mgr-2',
    email: 'mgr2@company.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-mgr-2',
  };

  beforeEach(async () => {
    repository = {
      findActivePrimaryByEmployeeId: jest.fn(),
      createWithAutoCloseTransaction: jest.fn(),
      findHistoryByEmployeeId: jest.fn(),
      findEmployeeById: jest.fn(),
    } as any;

    auditLogService = {
      record: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingLineService,
        {
          provide: ReportingLineRepository,
          useValue: repository,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    }).compile();

    service = module.get<ReportingLineService>(ReportingLineService);
  });

  describe('create()', () => {
    it('1. Sukses membuat reporting line baru: mengeksekusi transaksi atomik auto-close primary line lama', async () => {
      repository.findEmployeeById.mockImplementation(async (id) => {
        if (id === 'emp-1') return mockSubordinate as any;
        if (id === 'emp-mgr-1') return mockManager as any;
        return null;
      });
      repository.createWithAutoCloseTransaction.mockResolvedValue(mockReportingLine as any);

      const dto = {
        managerId: 'emp-mgr-1',
        effectiveFrom: '2026-01-01',
        isPrimary: true,
      };

      const result = await service.create('emp-1', dto, hrAdminUser);

      expect(repository.createWithAutoCloseTransaction).toHaveBeenCalledWith(
        'emp-1',
        expect.objectContaining({
          employeeId: 'emp-1',
          managerId: 'emp-mgr-1',
          effectiveFrom: new Date('2026-01-01'),
          isPrimary: true,
        }),
        true,
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_REPORTING_LINE',
          entity: 'EmployeeReportingLine',
          entityId: 'rep-1',
        }),
      );
      expect(result.id).toBe('rep-1');
    });

    it('2. Gagal jika employeeId sama dengan managerId (self-reporting) -> BadRequestException', async () => {
      await expect(
        service.create(
          'emp-1',
          {
            managerId: 'emp-1',
            effectiveFrom: '2026-01-01',
          },
          hrAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('3. Gagal jika subordinate atau manager tidak ditemukan -> NotFoundException', async () => {
      repository.findEmployeeById.mockResolvedValue(null);

      await expect(
        service.create(
          'emp-1',
          {
            managerId: 'emp-mgr-999',
            effectiveFrom: '2026-01-01',
          },
          hrAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('4. Gagal jika transaksi repository melempar error (rollback)', async () => {
      repository.findEmployeeById.mockImplementation(async (id) => {
        if (id === 'emp-1') return mockSubordinate as any;
        if (id === 'emp-mgr-1') return mockManager as any;
        return null;
      });
      repository.createWithAutoCloseTransaction.mockRejectedValue(
        new Error('Transaction aborted'),
      );

      const dto = {
        managerId: 'emp-mgr-1',
        effectiveFrom: '2026-01-01',
        isPrimary: true,
      };

      await expect(service.create('emp-1', dto, hrAdminUser)).rejects.toThrow(
        'Transaction aborted',
      );
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe('findActiveByEmployeeId() and findHistoryByEmployeeId()', () => {
    it('5. Sukses mengambil reporting line aktif untuk diri sendiri (EMPLOYEE)', async () => {
      repository.findEmployeeById.mockResolvedValue(mockSubordinate as any);
      repository.findActivePrimaryByEmployeeId.mockResolvedValue(mockReportingLine as any);

      const result = await service.findActiveByEmployeeId('emp-1', employeeUser);
      expect(result?.managerId).toBe('emp-mgr-1');
    });

    it('6. Gagal jika EMPLOYEE melihat reporting line karyawan lain -> ForbiddenException', async () => {
      await expect(
        service.findActiveByEmployeeId('emp-1', otherEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('7. MANAGER sukses melihat history reporting line karyawan di departemennya', async () => {
      repository.findEmployeeById.mockImplementation(async (id) => {
        if (id === 'emp-1') return mockSubordinate as any;
        if (id === 'emp-mgr-1') return mockManager as any;
        return null;
      });
      repository.findHistoryByEmployeeId.mockResolvedValue([mockReportingLine as any]);

      const result = await service.findHistoryByEmployeeId('emp-1', managerSameDeptUser);
      expect(result.data).toHaveLength(1);
    });

    it('8. MANAGER gagal melihat reporting line karyawan di departemen berbeda -> ForbiddenException', async () => {
      repository.findEmployeeById.mockImplementation(async (id) => {
        if (id === 'emp-1') return mockSubordinate as any;
        if (id === 'emp-mgr-2') return { id: 'emp-mgr-2', departmentId: 'dept-2' } as any;
        return null;
      });

      await expect(
        service.findHistoryByEmployeeId('emp-1', managerOtherDeptUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
