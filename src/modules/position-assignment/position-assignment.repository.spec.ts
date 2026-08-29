import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentType, MovementType } from '@prisma/client';
import { PositionAssignmentRepository } from './position-assignment.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('PositionAssignmentRepository', () => {
  let repository: PositionAssignmentRepository;
  let prisma: PrismaService;

  const mockTx = {
    employeePositionAssignment: {
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    employeeMovementHistory: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionAssignmentRepository,
        {
          provide: PrismaService,
          useValue: {
            employeePositionAssignment: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              updateMany: jest.fn(),
              create: jest.fn(),
            },
            employee: {
              findUnique: jest.fn(),
            },
            position: {
              findUnique: jest.fn(),
            },
            department: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(mockTx)),
          },
        },
      ],
    }).compile();

    repository = module.get<PositionAssignmentRepository>(
      PositionAssignmentRepository,
    );
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createAssignmentWithMovementTransaction()', () => {
    it('1. Atomic Transaction: Sukses menutup assignment lama, membuat assignment baru, dan mencatat movement history dalam satu tx', async () => {
      const input = {
        employeeId: 'emp-1',
        assignmentData: {
          employeeId: 'emp-1',
          positionId: 'pos-2',
          departmentId: 'dept-1',
          effectiveFrom: new Date('2026-06-01'),
          effectiveTo: null,
          assignmentType: AssignmentType.PROMOTION,
          notes: 'Promoted',
          assignedById: 'user-admin',
        },
        movementData: {
          movementType: MovementType.PROMOTION,
          fromPositionId: 'pos-1',
          toPositionId: 'pos-2',
          fromDepartmentId: 'dept-1',
          toDepartmentId: 'dept-1',
          effectiveDate: new Date('2026-06-01'),
          reason: 'Promoted',
          performedById: 'user-admin',
        },
      };

      const expectedAssignment = {
        id: 'assign-2',
        ...input.assignmentData,
      };

      mockTx.employeePositionAssignment.updateMany.mockResolvedValue({ count: 1 });
      mockTx.employeePositionAssignment.create.mockResolvedValue(expectedAssignment);
      mockTx.employeeMovementHistory.create.mockResolvedValue({ id: 'mov-1' });

      const result = await repository.createAssignmentWithMovementTransaction(input);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.employeePositionAssignment.updateMany).toHaveBeenCalledWith({
        where: {
          employeeId: 'emp-1',
          effectiveTo: null,
        },
        data: {
          effectiveTo: input.assignmentData.effectiveFrom,
        },
      });
      expect(mockTx.employeePositionAssignment.create).toHaveBeenCalledWith({
        data: input.assignmentData,
        include: expect.any(Object),
      });
      expect(mockTx.employeeMovementHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          employeeId: 'emp-1',
          movementType: MovementType.PROMOTION,
        }),
      });
      expect(result).toEqual(expectedAssignment);
    });

    it('2. Atomic Rollback: Jika pembuatan movement history gagal, transaksi melempar error dan membatalkan seluruh operasi', async () => {
      const input = {
        employeeId: 'emp-1',
        assignmentData: {
          employeeId: 'emp-1',
          positionId: 'pos-2',
          departmentId: 'dept-1',
          effectiveFrom: new Date('2026-06-01'),
          effectiveTo: null,
          assignmentType: AssignmentType.PROMOTION,
          notes: 'Promoted',
          assignedById: 'user-admin',
        },
        movementData: {
          movementType: MovementType.PROMOTION,
          fromPositionId: 'pos-1',
          toPositionId: 'pos-2',
          fromDepartmentId: 'dept-1',
          toDepartmentId: 'dept-1',
          effectiveDate: new Date('2026-06-01'),
          reason: 'Promoted',
          performedById: 'user-admin',
        },
      };

      mockTx.employeePositionAssignment.updateMany.mockResolvedValue({ count: 1 });
      mockTx.employeePositionAssignment.create.mockResolvedValue({ id: 'assign-2' });
      mockTx.employeeMovementHistory.create.mockRejectedValue(
        new Error('Database error in movement history insertion'),
      );

      await expect(
        repository.createAssignmentWithMovementTransaction(input),
      ).rejects.toThrow('Database error in movement history insertion');
    });
  });
});
