import { Test, TestingModule } from '@nestjs/testing';
import { ContractStatus, EmployeeStatus, MovementType, Prisma, UserRole } from '@prisma/client';
import { EmployeeRepository } from './employee.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('EmployeeRepository', () => {
  let repository: EmployeeRepository;
  let prisma: PrismaService;

  const mockEmployee = {
    id: 'emp-uuid-1',
    departmentId: 'dept-uuid-1',
    nip: 'EMP001',
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '081234567890',
    jobTitle: 'Engineer',
    hireDate: new Date('2024-01-01'),
    baseSalary: new Prisma.Decimal(10000000),
    status: EmployeeStatus.ACTIVE,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-uuid-1',
    email: 'john@example.com',
    passwordHash: 'hashed_pw',
    role: UserRole.EMPLOYEE,
    isActive: true,
    employeeId: 'emp-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTx = {
    employee: {
      create: jest.fn().mockResolvedValue(mockEmployee),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...mockEmployee, ...data }),
      ),
    },
    user: {
      create: jest.fn().mockResolvedValue(mockUser),
      findFirst: jest.fn().mockResolvedValue({ id: 'user-admin', role: UserRole.HR_ADMIN }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    employmentContract: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    employeePositionAssignment: {
      findFirst: jest.fn().mockResolvedValue({ id: 'assign-1', positionId: 'pos-1', departmentId: 'dept-1' }),
      update: jest.fn().mockResolvedValue({ id: 'assign-1' }),
    },
    employeeMovementHistory: {
      create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeRepository,
        {
          provide: PrismaService,
          useValue: {
            employee: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            user: {
              create: jest.fn(),
              findUnique: jest.fn(),
              updateMany: jest.fn(),
            },
            department: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(mockTx)),
          },
        },
      ],
    }).compile();

    repository = module.get<EmployeeRepository>(EmployeeRepository);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createWithUser()', () => {
    it('1. Sukses membuat Employee dan User dalam satu transaksi', async () => {
      const employeeData = {
        nip: 'EMP001',
        fullName: 'John Doe',
        email: 'john@example.com',
        jobTitle: 'Engineer',
        hireDate: new Date('2024-01-01'),
        baseSalary: new Prisma.Decimal(10000000),
        departmentId: 'dept-uuid-1',
      };

      const userData = {
        email: 'john@example.com',
        passwordHash: 'hashed_pw',
        role: UserRole.EMPLOYEE,
      };

      const result = await repository.createWithUser(employeeData, userData);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe('emp-uuid-1');
    });
  });

  describe('terminateWithSideEffects() - Atomic Transaction & Rollback', () => {
    it('2. Atomic Transaction: Sukses terminate employee, deactivate user, terminate contracts, close assignment, create movement history', async () => {
      mockTx.employee.update.mockResolvedValue({
        ...mockEmployee,
        status: EmployeeStatus.TERMINATED,
        deletedAt: new Date(),
      });
      mockTx.user.updateMany.mockResolvedValue({ count: 1 });
      mockTx.employmentContract.updateMany.mockResolvedValue({ count: 1 });
      mockTx.employeePositionAssignment.findFirst.mockResolvedValue({
        id: 'assign-1',
        positionId: 'pos-1',
        departmentId: 'dept-1',
      });
      mockTx.employeePositionAssignment.update.mockResolvedValue({ id: 'assign-1' });
      mockTx.employeeMovementHistory.create.mockResolvedValue({ id: 'mov-1' });

      const result = await repository.terminateWithSideEffects('emp-uuid-1', 'user-admin');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-uuid-1' },
        data: {
          status: EmployeeStatus.TERMINATED,
          deletedAt: expect.any(Date),
        },
      });
      expect(mockTx.user.updateMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp-uuid-1' },
        data: { isActive: false },
      });
      expect(mockTx.employmentContract.updateMany).toHaveBeenCalledWith({
        where: {
          employeeId: 'emp-uuid-1',
          status: ContractStatus.ACTIVE,
        },
        data: { status: ContractStatus.TERMINATED },
      });
      expect(mockTx.employeeMovementHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          employeeId: 'emp-uuid-1',
          movementType: MovementType.TERMINATION,
          performedById: 'user-admin',
        }),
      });
      expect(result.status).toBe(EmployeeStatus.TERMINATED);
    });

    it('3. Atomic Rollback: Jika pembuatan movement history gagal saat terminate, transaksi gagal total dan melempar error', async () => {
      mockTx.employee.update.mockResolvedValue({
        ...mockEmployee,
        status: EmployeeStatus.TERMINATED,
        deletedAt: new Date(),
      });
      mockTx.employeeMovementHistory.create.mockRejectedValue(
        new Error('Database error during movement history creation'),
      );

      await expect(
        repository.terminateWithSideEffects('emp-uuid-1', 'user-admin'),
      ).rejects.toThrow('Database error during movement history creation');
    });
  });

  describe('findAll() & countAll()', () => {
    it('4. findAll tanpa status filter mengembalikan semua status tanpa pembatasan deletedAt: null', async () => {
      (prisma.employee.findMany as jest.Mock).mockResolvedValue([mockEmployee]);

      await repository.findAll({ skip: 0, take: 10 });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('5. findAll dengan filter status INACTIVE tidak membatasi deletedAt: null', async () => {
      (prisma.employee.findMany as jest.Mock).mockResolvedValue([
        { ...mockEmployee, status: EmployeeStatus.INACTIVE, deletedAt: new Date() },
      ]);

      await repository.findAll({ skip: 0, take: 10, status: EmployeeStatus.INACTIVE });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: EmployeeStatus.INACTIVE,
          }),
        }),
      );

      const calledWhere = (prisma.employee.findMany as jest.Mock).mock.calls[0][0].where;
      expect(calledWhere.deletedAt).toBeUndefined();
    });
  });

  describe('findByIdIncludingDeleted()', () => {
    it('6. findByIdIncludingDeleted mencari karyawan tanpa filter deletedAt: null', async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue({
        ...mockEmployee,
        deletedAt: new Date(),
      });

      const result = await repository.findByIdIncludingDeleted('emp-uuid-1');

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-uuid-1' },
        include: { department: true },
      });
      expect(result).toBeDefined();
      expect(result?.deletedAt).toBeDefined();
    });
  });
});
