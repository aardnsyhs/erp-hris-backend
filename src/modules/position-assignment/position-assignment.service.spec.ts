import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentType, MovementType, UserRole } from '@prisma/client';
import { PositionAssignmentService } from './position-assignment.service';
import { PositionAssignmentRepository } from './position-assignment.repository';
import { MovementHistoryService } from '../movement-history/movement-history.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('PositionAssignmentService', () => {
  let service: PositionAssignmentService;
  let repository: Record<keyof PositionAssignmentRepository, jest.Mock>;
  let movementHistoryService: Record<keyof MovementHistoryService, jest.Mock>;
  let auditLogService: Record<keyof AuditLogService, jest.Mock>;

  const mockEmployee = {
    id: 'emp-1',
    nip: 'EMP001',
    fullName: 'John Doe',
    departmentId: 'dept-1',
    deletedAt: null,
  };

  const mockPosition = {
    id: 'pos-2',
    code: 'ENG-SR',
    title: 'Senior Engineer',
    level: 3,
    isActive: true,
  };

  const mockInactivePosition = {
    id: 'pos-inactive',
    code: 'OLD-POS',
    title: 'Deprecated Position',
    level: 2,
    isActive: false,
  };

  const mockDepartment = {
    id: 'dept-1',
    code: 'ENG',
    name: 'Engineering',
  };

  const mockActiveAssignment = {
    id: 'assign-1',
    employeeId: 'emp-1',
    positionId: 'pos-1',
    departmentId: 'dept-1',
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
    assignmentType: AssignmentType.INITIAL,
    notes: 'Initial hire',
    assignedById: 'user-admin',
  };

  const mockNewAssignment = {
    id: 'assign-2',
    employeeId: 'emp-1',
    positionId: 'pos-2',
    departmentId: 'dept-1',
    effectiveFrom: new Date('2026-06-01'),
    effectiveTo: null,
    assignmentType: AssignmentType.PROMOTION,
    notes: 'Promoted to Senior Engineer',
    assignedById: 'user-admin',
    position: mockPosition,
    department: mockDepartment,
    assignedBy: { id: 'user-admin', email: 'admin@company.com', role: 'HR_ADMIN' },
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
      findActiveByEmployeeId: jest.fn(),
      createAssignmentWithMovementTransaction: jest.fn(),
      findHistoryByEmployeeId: jest.fn(),
      findEmployeeById: jest.fn(),
      findPositionById: jest.fn(),
      findDepartmentById: jest.fn(),
    } as any;

    movementHistoryService = {
      recordMovement: jest.fn(),
      findByEmployeeId: jest.fn(),
    } as any;

    auditLogService = {
      record: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionAssignmentService,
        {
          provide: PositionAssignmentRepository,
          useValue: repository,
        },
        {
          provide: MovementHistoryService,
          useValue: movementHistoryService,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    }).compile();

    service = module.get<PositionAssignmentService>(PositionAssignmentService);
  });

  describe('create()', () => {
    it('1. Sukses assign posisi baru: mengeksekusi transaksi atomik (auto-close & create movement history)', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findPositionById.mockResolvedValue(mockPosition as any);
      repository.findDepartmentById.mockResolvedValue(mockDepartment as any);
      repository.findActiveByEmployeeId.mockResolvedValue(mockActiveAssignment as any);
      repository.createAssignmentWithMovementTransaction.mockResolvedValue(mockNewAssignment as any);

      const dto = {
        positionId: 'pos-2',
        departmentId: 'dept-1',
        effectiveFrom: '2026-06-01',
        assignmentType: AssignmentType.PROMOTION,
        notes: 'Promoted to Senior Engineer',
      };

      const result = await service.create('emp-1', dto, hrAdminUser);

      // Atomic transaction invocation check
      expect(
        repository.createAssignmentWithMovementTransaction,
      ).toHaveBeenCalledWith({
        employeeId: 'emp-1',
        assignmentData: expect.objectContaining({
          employeeId: 'emp-1',
          positionId: 'pos-2',
          departmentId: 'dept-1',
          effectiveFrom: new Date('2026-06-01'),
          effectiveTo: null,
          assignmentType: AssignmentType.PROMOTION,
        }),
        movementData: expect.objectContaining({
          movementType: MovementType.PROMOTION,
          fromPositionId: 'pos-1',
          toPositionId: 'pos-2',
          fromDepartmentId: 'dept-1',
          toDepartmentId: 'dept-1',
          effectiveDate: new Date('2026-06-01'),
        }),
      });

      // Non-blocking audit log record
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_POSITION_ASSIGNMENT',
          entity: 'EmployeePositionAssignment',
          entityId: 'assign-2',
        }),
      );

      expect(result.id).toBe('assign-2');
    });

    it('2. Gagal jika transaksi repository melempar error (rollback)', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findPositionById.mockResolvedValue(mockPosition as any);
      repository.findDepartmentById.mockResolvedValue(mockDepartment as any);
      repository.findActiveByEmployeeId.mockResolvedValue(mockActiveAssignment as any);
      repository.createAssignmentWithMovementTransaction.mockRejectedValue(
        new Error('Transaction failed and rolled back'),
      );

      const dto = {
        positionId: 'pos-2',
        departmentId: 'dept-1',
        effectiveFrom: '2026-06-01',
        assignmentType: AssignmentType.PROMOTION,
      };

      await expect(service.create('emp-1', dto, hrAdminUser)).rejects.toThrow(
        'Transaction failed and rolled back',
      );
      expect(auditLogService.record).not.toHaveBeenCalled();
    });

    it('3. Gagal jika posisi sedang tidak aktif (isActive=false) -> BadRequestException', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findPositionById.mockResolvedValue(mockInactivePosition as any);

      await expect(
        service.create(
          'emp-1',
          {
            positionId: 'pos-inactive',
            departmentId: 'dept-1',
            effectiveFrom: '2026-06-01',
            assignmentType: AssignmentType.TRANSFER,
          },
          hrAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. Gagal jika employee tidak ditemukan -> NotFoundException', async () => {
      repository.findEmployeeById.mockResolvedValue(null);

      await expect(
        service.create(
          'emp-999',
          {
            positionId: 'pos-2',
            departmentId: 'dept-1',
            effectiveFrom: '2026-06-01',
            assignmentType: AssignmentType.INITIAL,
          },
          hrAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActiveByEmployeeId() and findHistoryByEmployeeId()', () => {
    it('5. Sukses mengambil penugasan aktif untuk diri sendiri (EMPLOYEE)', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findActiveByEmployeeId.mockResolvedValue(mockNewAssignment as any);

      const result = await service.findActiveByEmployeeId('emp-1', employeeUser);
      expect(result?.positionId).toBe('pos-2');
    });

    it('6. Gagal jika EMPLOYEE melihat penugasan karyawan lain -> ForbiddenException', async () => {
      await expect(
        service.findActiveByEmployeeId('emp-1', otherEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('7. MANAGER sukses melihat history penugasan karyawan satu departemen', async () => {
      repository.findEmployeeById.mockImplementation(async (id) => {
        if (id === 'emp-1') return mockEmployee as any;
        if (id === 'emp-mgr-1') return { id: 'emp-mgr-1', departmentId: 'dept-1' } as any;
        return null;
      });
      repository.findHistoryByEmployeeId.mockResolvedValue([mockNewAssignment as any]);

      const result = await service.findHistoryByEmployeeId('emp-1', managerSameDeptUser);
      expect(result.data).toHaveLength(1);
    });

    it('8. MANAGER gagal melihat penugasan karyawan departemen berbeda -> ForbiddenException', async () => {
      repository.findEmployeeById.mockImplementation(async (id) => {
        if (id === 'emp-1') return mockEmployee as any;
        if (id === 'emp-mgr-2') return { id: 'emp-mgr-2', departmentId: 'dept-2' } as any;
        return null;
      });

      await expect(
        service.findHistoryByEmployeeId('emp-1', managerOtherDeptUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
