import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ContractStatus, ContractType, UserRole } from '@prisma/client';
import { ContractService } from './contract.service';
import { ContractRepository } from './contract.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('ContractService', () => {
  let service: ContractService;
  let repository: Record<keyof ContractRepository, jest.Mock>;
  let auditLogService: Record<keyof AuditLogService, jest.Mock>;

  const mockEmployee = {
    id: 'emp-1',
    nip: 'EMP001',
    fullName: 'John Doe',
    deletedAt: null,
  };

  const mockDocument = {
    id: 'doc-1',
    employeeId: 'emp-1',
    title: 'Kontrak Kerja PKWT 2026',
    fileName: 'kontrak_2026.pdf',
    deletedAt: null,
  };

  const mockContract = {
    id: 'contract-1',
    employeeId: 'emp-1',
    contractType: ContractType.CONTRACT,
    contractNumber: 'CTR/2026/001',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: ContractStatus.ACTIVE,
    renewalReminderDate: new Date('2026-11-30'),
    notes: 'PKWT 1 Tahun',
    documentId: 'doc-1',
    document: mockDocument,
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
    email: 'john@company.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-1',
  };

  const otherEmployeeUser: AuthenticatedUser = {
    userId: 'user-emp-2',
    email: 'jane@company.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-2',
  };

  const managerUser: AuthenticatedUser = {
    userId: 'user-mgr-1',
    email: 'mgr1@company.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-mgr-1',
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      createWithOverlapCheckTransaction: jest.fn(),
      findById: jest.fn(),
      findByContractNumber: jest.fn(),
      findActiveContractsByEmployeeId: jest.fn(),
      findOverlappingActiveContract: jest.fn(),
      updateStatus: jest.fn(),
      updateStatusWithOverlapCheckTransaction: jest.fn(),
      terminateActiveContractsForEmployee: jest.fn(),
      findManyByEmployeeId: jest.fn(),
      findEmployeeById: jest.fn(),
      findDocumentById: jest.fn(),
    } as any;

    auditLogService = {
      record: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractService,
        {
          provide: ContractRepository,
          useValue: repository,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    }).compile();

    service = module.get<ContractService>(ContractService);
  });

  describe('create()', () => {
    it('1. Sukses membuat kontrak baru via createWithOverlapCheckTransaction dan mencatat audit log', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findByContractNumber.mockResolvedValue(null);
      repository.findDocumentById.mockResolvedValue(mockDocument as any);
      repository.createWithOverlapCheckTransaction.mockResolvedValue(mockContract as any);

      const dto = {
        contractType: ContractType.CONTRACT,
        contractNumber: 'CTR/2026/001',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: ContractStatus.ACTIVE,
        documentId: 'doc-1',
      };

      const result = await service.create('emp-1', dto, hrAdminUser);

      expect(repository.createWithOverlapCheckTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-1',
          contractNumber: 'CTR/2026/001',
          status: ContractStatus.ACTIVE,
        }),
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_CONTRACT',
          entity: 'EmploymentContract',
          entityId: 'contract-1',
        }),
      );
      expect(result.id).toBe('contract-1');
    });

    it('2. Gagal jika nomor kontrak sudah terdaftar -> ConflictException', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findByContractNumber.mockResolvedValue(mockContract as any);

      await expect(
        service.create(
          'emp-1',
          {
            contractType: ContractType.CONTRACT,
            contractNumber: 'CTR/2026/001',
            startDate: '2026-01-01',
          },
          hrAdminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('3. Gagal jika endDate lebih awal dari startDate -> BadRequestException', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findByContractNumber.mockResolvedValue(null);

      await expect(
        service.create(
          'emp-1',
          {
            contractType: ContractType.CONTRACT,
            contractNumber: 'CTR/2026/002',
            startDate: '2026-06-01',
            endDate: '2026-01-01',
          },
          hrAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. Gagal jika transaksi overlap repository melempar ConflictException (overlap rollback)', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findByContractNumber.mockResolvedValue(null);
      repository.createWithOverlapCheckTransaction.mockRejectedValue(
        new ConflictException('Overlap detected inside transaction'),
      );

      await expect(
        service.create(
          'emp-1',
          {
            contractType: ContractType.CONTRACT,
            contractNumber: 'CTR/2026/002',
            startDate: '2026-06-01',
            endDate: '2027-06-01',
            status: ContractStatus.ACTIVE,
          },
          hrAdminUser,
        ),
      ).rejects.toThrow(ConflictException);
      expect(auditLogService.record).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus() - Immutable Transition Guard & Atomic Update', () => {
    it('5. Sukses transisi status kontrak ACTIVE -> RENEWED via updateStatusWithOverlapCheckTransaction', async () => {
      repository.findById.mockResolvedValue(mockContract as any);
      const updated = { ...mockContract, status: ContractStatus.RENEWED };
      repository.updateStatusWithOverlapCheckTransaction.mockResolvedValue(updated as any);

      const result = await service.updateStatus(
        'emp-1',
        'contract-1',
        { status: ContractStatus.RENEWED, notes: 'Renewed for next year' },
        hrAdminUser,
      );

      expect(
        repository.updateStatusWithOverlapCheckTransaction,
      ).toHaveBeenCalledWith(
        'contract-1',
        'emp-1',
        ContractStatus.RENEWED,
        'Renewed for next year',
      );
      expect(result.status).toBe(ContractStatus.RENEWED);
    });

    it('6. Gagal jika kontrak terminal (EXPIRED/TERMINATED/RENEWED) diubah kembali ke ACTIVE -> BadRequestException', async () => {
      const expiredContract = {
        ...mockContract,
        status: ContractStatus.EXPIRED,
      };
      repository.findById.mockResolvedValue(expiredContract as any);

      await expect(
        service.updateStatus(
          'emp-1',
          'contract-1',
          { status: ContractStatus.ACTIVE },
          hrAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. Gagal jika kontrak tidak ditemukan -> NotFoundException', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'emp-1',
          'contract-999',
          { status: ContractStatus.TERMINATED },
          hrAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmployeeId() and findById() - Scoping & Security', () => {
    it('8. Sukses diambil oleh EMPLOYEE untuk kontrak miliknya sendiri', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findManyByEmployeeId.mockResolvedValue([mockContract as any]);

      const result = await service.findByEmployeeId('emp-1', employeeUser);
      expect(result.data).toHaveLength(1);
    });

    it('9. Gagal jika EMPLOYEE melihat kontrak karyawan lain -> ForbiddenException', async () => {
      await expect(
        service.findByEmployeeId('emp-1', otherEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('10. Gagal jika MANAGER mencoba mengakses kontrak karyawan -> ForbiddenException', async () => {
      await expect(
        service.findByEmployeeId('emp-1', managerUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
