import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeStatus, Prisma, UserRole } from '@prisma/client';
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
            $transaction: jest.fn((callback) => {
              // Pass the mock prisma as the transaction client
              return callback({
                employee: {
                  create: jest.fn().mockResolvedValue(mockEmployee),
                  update: jest.fn().mockImplementation(({ data }) =>
                    Promise.resolve({ ...mockEmployee, ...data }),
                  ),
                },
                user: {
                  create: jest.fn().mockResolvedValue(mockUser),
                  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
              });
            }),
          },
        },
      ],
    }).compile();

    repository = module.get<EmployeeRepository>(EmployeeRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createWithUser()', () => {
    it('1. Membuat Employee dan User secara atomik dalam satu transaction', async () => {
      const employeeData = {
        departmentId: 'dept-uuid-1',
        nip: 'EMP001',
        fullName: 'John Doe',
        email: 'john@example.com',
        jobTitle: 'Engineer',
        hireDate: new Date('2024-01-01'),
        baseSalary: new Prisma.Decimal(10000000),
      };

      const userData = {
        email: 'john@example.com',
        passwordHash: 'hashed_pw',
        role: UserRole.EMPLOYEE,
      };

      const result = await repository.createWithUser(employeeData, userData);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.id).toBe('emp-uuid-1');
    });
  });

  describe('softDelete()', () => {
    it('2. Soft delete: menonaktifkan Employee (INACTIVE, deletedAt terisi) dan menyinkronkan User (isActive: false) dalam satu transaction', async () => {
      const result = await repository.softDelete('emp-uuid-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(EmployeeStatus.INACTIVE);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('2b. Soft delete: memberhentikan permanen Employee (TERMINATED, deletedAt terisi) dan menyinkronkan User (isActive: false)', async () => {
      const result = await repository.softDelete(
        'emp-uuid-1',
        EmployeeStatus.TERMINATED,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(EmployeeStatus.TERMINATED);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('reactivate()', () => {
    it('3. Reaktivasi: mengaktifkan kembali Employee (ACTIVE, deletedAt: null) dan menyinkronkan User (isActive: true) dalam satu transaction', async () => {
      const result = await repository.reactivate('emp-uuid-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(EmployeeStatus.ACTIVE);
      expect(result.deletedAt).toBeNull();
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

      // Verify that deletedAt: null is NOT in the where clause
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
