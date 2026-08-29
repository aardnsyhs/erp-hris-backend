import { Test, TestingModule } from '@nestjs/testing';
import { MovementType, UserRole } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MovementHistoryService } from './movement-history.service';
import { MovementHistoryRepository } from './movement-history.repository';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('MovementHistoryService', () => {
  let service: MovementHistoryService;
  let repository: Record<keyof MovementHistoryRepository, jest.Mock>;

  const mockEmployee = {
    id: 'emp-1',
    nip: 'EMP001',
    fullName: 'John Doe',
    departmentId: 'dept-1',
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
  };

  const mockManager = {
    id: 'emp-mgr-1',
    departmentId: 'dept-1',
  };

  const mockOtherManager = {
    id: 'emp-mgr-2',
    departmentId: 'dept-2',
  };

  const mockMovement = {
    id: 'mov-1',
    employeeId: 'emp-1',
    movementType: MovementType.PROMOTION,
    fromPositionId: 'pos-1',
    toPositionId: 'pos-2',
    fromDepartmentId: 'dept-1',
    toDepartmentId: 'dept-1',
    effectiveDate: new Date('2026-06-01'),
    reason: 'Promoted to Senior Engineer',
    performedById: 'user-admin',
    createdAt: new Date('2026-06-01'),
    fromPosition: { id: 'pos-1', code: 'ENG-JR', title: 'Junior Engineer', level: 1 },
    toPosition: { id: 'pos-2', code: 'ENG-SR', title: 'Senior Engineer', level: 2 },
    fromDepartment: { id: 'dept-1', code: 'ENG', name: 'Engineering' },
    toDepartment: { id: 'dept-1', code: 'ENG', name: 'Engineering' },
    performedBy: { id: 'user-admin', email: 'admin@company.com', role: UserRole.HR_ADMIN },
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
    email: 'manager1@company.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-mgr-1',
  };

  const managerOtherDeptUser: AuthenticatedUser = {
    userId: 'user-mgr-2',
    email: 'manager2@company.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-mgr-2',
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findByEmployeeId: jest.fn(),
      findEmployeeById: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementHistoryService,
        {
          provide: MovementHistoryRepository,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<MovementHistoryService>(MovementHistoryService);
  });

  describe('recordMovement() - Internal Append-Only', () => {
    it('1. Sukses mencatat entri riwayat pergerakan karyawan', async () => {
      repository.create.mockResolvedValue(mockMovement as any);

      const input = {
        employeeId: 'emp-1',
        movementType: MovementType.PROMOTION,
        fromPositionId: 'pos-1',
        toPositionId: 'pos-2',
        fromDepartmentId: 'dept-1',
        toDepartmentId: 'dept-1',
        effectiveDate: new Date('2026-06-01'),
        reason: 'Promoted',
        performedById: 'user-admin',
      };

      const result = await service.recordMovement(input);
      expect(repository.create).toHaveBeenCalledWith(input);
      expect(result).toEqual(mockMovement);
    });
  });

  describe('findByEmployeeId() - Scoped Timeline Queries', () => {
    it('2. HR_ADMIN sukses melihat seluruh timeline pergerakan karyawan', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findByEmployeeId.mockResolvedValue([mockMovement as any]);

      const result = await service.findByEmployeeId('emp-1', hrAdminUser);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].movementType).toBe(MovementType.PROMOTION);
      expect(result.data[0].toPosition?.title).toBe('Senior Engineer');
    });

    it('3. EMPLOYEE sukses melihat timeline pergerakan dirinya sendiri', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findByEmployeeId.mockResolvedValue([mockMovement as any]);

      const result = await service.findByEmployeeId('emp-1', employeeUser);
      expect(result.data).toHaveLength(1);
    });

    it('4. EMPLOYEE gagal melihat timeline pergerakan karyawan lain -> ForbiddenException', async () => {
      await expect(
        service.findByEmployeeId('emp-1', otherEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('5. MANAGER sukses melihat timeline karyawan di departemen yang sama', async () => {
      repository.findEmployeeById.mockImplementation(async (id) => {
        if (id === 'emp-1') return mockEmployee as any;
        if (id === 'emp-mgr-1') return mockManager as any;
        return null;
      });
      repository.findByEmployeeId.mockResolvedValue([mockMovement as any]);

      const result = await service.findByEmployeeId('emp-1', managerSameDeptUser);
      expect(result.data).toHaveLength(1);
    });

    it('6. MANAGER gagal melihat timeline karyawan di departemen berbeda -> ForbiddenException', async () => {
      repository.findEmployeeById.mockImplementation(async (id) => {
        if (id === 'emp-1') return mockEmployee as any;
        if (id === 'emp-mgr-2') return mockOtherManager as any;
        return null;
      });

      await expect(
        service.findByEmployeeId('emp-1', managerOtherDeptUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('7. Gagal jika target karyawan tidak ditemukan -> NotFoundException', async () => {
      repository.findEmployeeById.mockResolvedValue(null);

      await expect(
        service.findByEmployeeId('emp-999', hrAdminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
