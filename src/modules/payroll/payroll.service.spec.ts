import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PayrollStatus, Prisma } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { PayrollRepository } from './payroll.repository';
import { CreatePayrollDto } from './dto/create-payroll.dto';

describe('PayrollService', () => {
  let payrollService: PayrollService;
  let payrollRepository: jest.Mocked<Partial<PayrollRepository>>;

  const mockEmployee = {
    id: 'emp-uuid-1',
    departmentId: 'dept-eng-uuid',
    nip: 'EMP001',
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '+628123456789',
    jobTitle: 'Software Engineer',
    hireDate: new Date('2024-01-01'),
    baseSalary: new Prisma.Decimal(10000000), // 10,000,000
    status: 'ACTIVE' as any,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPayroll = {
    id: 'payroll-uuid-1',
    employeeId: 'emp-uuid-1',
    periodStart: new Date('2026-08-01'),
    periodEnd: new Date('2026-08-31'),
    basicSalary: new Prisma.Decimal(10000000),
    allowances: new Prisma.Decimal(2000000),
    deductions: new Prisma.Decimal(500000),
    netSalary: new Prisma.Decimal(11500000),
    status: PayrollStatus.DRAFT,
    paymentDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    payrollRepository = {
      create: jest.fn(),
      findByEmployeeAndPeriod: jest.fn(),
      findEmployeeById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PayrollRepository, useValue: payrollRepository },
      ],
    }).compile();

    payrollService = module.get<PayrollService>(PayrollService);
  });

  describe('create()', () => {
    const createDto: CreatePayrollDto = {
      employeeId: 'emp-uuid-1',
      periodStart: new Date('2026-08-01'),
      periodEnd: new Date('2026-08-31'),
      allowances: '2000000',
      deductions: '500000',
    };

    it('1. Sukses generate draft: basicSalary ter-snapshot dan netSalary terhitung benar (basic + allowances - deductions)', async () => {
      payrollRepository.findEmployeeById = jest.fn().mockResolvedValue(mockEmployee);
      payrollRepository.findByEmployeeAndPeriod = jest.fn().mockResolvedValue(null);
      payrollRepository.create = jest.fn().mockResolvedValue(mockPayroll);

      const result = await payrollService.create(createDto);

      expect(result).toBeDefined();
      expect(payrollRepository.findEmployeeById).toHaveBeenCalledWith('emp-uuid-1');
      expect(payrollRepository.findByEmployeeAndPeriod).toHaveBeenCalledWith(
        'emp-uuid-1',
        createDto.periodStart,
        createDto.periodEnd,
      );

      // Verify Decimal-safe snapshot and computation
      expect(payrollRepository.create).toHaveBeenCalledWith({
        employeeId: 'emp-uuid-1',
        periodStart: createDto.periodStart,
        periodEnd: createDto.periodEnd,
        basicSalary: new Prisma.Decimal(10000000),
        allowances: new Prisma.Decimal(2000000),
        deductions: new Prisma.Decimal(500000),
        netSalary: new Prisma.Decimal(11500000), // 10,000,000 + 2,000,000 - 500,000
        status: PayrollStatus.DRAFT,
      });
    });

    it('2. Sukses generate draft saat deductions > (basicSalary + allowances): netSalary bernilai negatif secara valid', async () => {
      payrollRepository.findEmployeeById = jest.fn().mockResolvedValue(mockEmployee);
      payrollRepository.findByEmployeeAndPeriod = jest.fn().mockResolvedValue(null);
      payrollRepository.create = jest.fn().mockImplementation((payload) => Promise.resolve(payload));

      const highDeductionDto: CreatePayrollDto = {
        employeeId: 'emp-uuid-1',
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        allowances: '1000000',
        deductions: '15000000', // 15,000,000 deduction on 11,000,000 gross
      };

      const result = await payrollService.create(highDeductionDto);

      expect(result).toBeDefined();
      // Expected netSalary: 10,000,000 + 1,000,000 - 15,000,000 = -4,000,000
      expect(result.netSalary.toString()).toBe('-4000000');
      expect(result.netSalary).toEqual(new Prisma.Decimal(-4000000));
    });

    it('3. Gagal: periodEnd lebih awal dari periodStart melempar BadRequestException', async () => {
      const invalidPeriodDto: CreatePayrollDto = {
        ...createDto,
        periodStart: new Date('2026-08-31'),
        periodEnd: new Date('2026-08-01'),
      };

      await expect(payrollService.create(invalidPeriodDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(payrollRepository.create).not.toHaveBeenCalled();
    });

    it('4. Gagal: employeeId tidak valid atau soft-deleted melempar BadRequestException', async () => {
      payrollRepository.findEmployeeById = jest.fn().mockResolvedValue(null);

      await expect(payrollService.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(payrollRepository.create).not.toHaveBeenCalled();
    });

    it('5. Gagal: periode duplikat untuk karyawan yang sama melempar ConflictException', async () => {
      payrollRepository.findEmployeeById = jest.fn().mockResolvedValue(mockEmployee);
      payrollRepository.findByEmployeeAndPeriod = jest.fn().mockResolvedValue(mockPayroll);

      await expect(payrollService.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(payrollRepository.create).not.toHaveBeenCalled();
    });
  });
});
