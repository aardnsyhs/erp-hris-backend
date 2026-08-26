import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PayrollStatus, Prisma } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { PayrollRepository } from './payroll.repository';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';

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

  const mockDraftPayroll = {
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
    employee: mockEmployee,
  };

  beforeEach(async () => {
    payrollRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmployeeAndPeriod: jest.fn(),
      findEmployeeById: jest.fn(),
      updateStatusIf: jest.fn(),
      updateDraftIf: jest.fn(),
      deleteDraftIf: jest.fn(),
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
      payrollRepository.create = jest.fn().mockResolvedValue(mockDraftPayroll);

      const result = await payrollService.create(createDto);

      expect(result).toBeDefined();
      expect(payrollRepository.create).toHaveBeenCalledWith({
        employeeId: 'emp-uuid-1',
        periodStart: createDto.periodStart,
        periodEnd: createDto.periodEnd,
        basicSalary: new Prisma.Decimal(10000000),
        allowances: new Prisma.Decimal(2000000),
        deductions: new Prisma.Decimal(500000),
        netSalary: new Prisma.Decimal(11500000),
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
        deductions: '15000000',
      };

      const result = await payrollService.create(highDeductionDto);

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
    });

    it('4. Gagal: employeeId tidak valid atau soft-deleted melempar BadRequestException', async () => {
      payrollRepository.findEmployeeById = jest.fn().mockResolvedValue(null);

      await expect(payrollService.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('5. Gagal: periode duplikat untuk karyawan yang sama melempar ConflictException', async () => {
      payrollRepository.findEmployeeById = jest.fn().mockResolvedValue(mockEmployee);
      payrollRepository.findByEmployeeAndPeriod = jest.fn().mockResolvedValue(mockDraftPayroll);

      await expect(payrollService.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('process()', () => {
    it('6. Sukses transisi DRAFT -> PROCESSED', async () => {
      payrollRepository.updateStatusIf = jest.fn().mockResolvedValue(1);
      payrollRepository.findById = jest.fn().mockResolvedValue({
        ...mockDraftPayroll,
        status: PayrollStatus.PROCESSED,
      });

      const result = await payrollService.process('payroll-uuid-1');

      expect(result?.status).toBe(PayrollStatus.PROCESSED);
      expect(payrollRepository.updateStatusIf).toHaveBeenCalledWith(
        'payroll-uuid-1',
        PayrollStatus.DRAFT,
        PayrollStatus.PROCESSED,
      );
    });

    it('7. Gagal process: status bukan DRAFT melempar ConflictException', async () => {
      payrollRepository.updateStatusIf = jest.fn().mockResolvedValue(0);
      payrollRepository.findById = jest.fn().mockResolvedValue({
        ...mockDraftPayroll,
        status: PayrollStatus.PROCESSED,
      });

      await expect(payrollService.process('payroll-uuid-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('8. Gagal process: ID tidak ditemukan melempar NotFoundException', async () => {
      payrollRepository.updateStatusIf = jest.fn().mockResolvedValue(0);
      payrollRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(payrollService.process('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('pay()', () => {
    it('9. Sukses transisi PROCESSED -> PAID dengan paymentDate terisi tanggal hari ini tanpa time component', async () => {
      payrollRepository.updateStatusIf = jest.fn().mockResolvedValue(1);
      payrollRepository.findById = jest.fn().mockResolvedValue({
        ...mockDraftPayroll,
        status: PayrollStatus.PAID,
        paymentDate: new Date('2026-08-26'),
      });

      const result = await payrollService.pay('payroll-uuid-1');

      expect(result?.status).toBe(PayrollStatus.PAID);
      expect(payrollRepository.updateStatusIf).toHaveBeenCalledWith(
        'payroll-uuid-1',
        PayrollStatus.PROCESSED,
        PayrollStatus.PAID,
        expect.any(Date),
      );

      // Verify paymentDate passed has 00:00:00.000 UTC
      const calledPaymentDate = (payrollRepository.updateStatusIf as jest.Mock).mock.calls[0][3] as Date;
      expect(calledPaymentDate.getUTCHours()).toBe(0);
      expect(calledPaymentDate.getUTCMinutes()).toBe(0);
      expect(calledPaymentDate.getUTCSeconds()).toBe(0);
      expect(calledPaymentDate.getUTCMilliseconds()).toBe(0);
    });

    it('10. Gagal pay: status bukan PROCESSED (masih DRAFT) melempar ConflictException', async () => {
      payrollRepository.updateStatusIf = jest.fn().mockResolvedValue(0);
      payrollRepository.findById = jest.fn().mockResolvedValue(mockDraftPayroll);

      await expect(payrollService.pay('payroll-uuid-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('11. Gagal pay: ID tidak ditemukan melempar NotFoundException', async () => {
      payrollRepository.updateStatusIf = jest.fn().mockResolvedValue(0);
      payrollRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(payrollService.pay('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update()', () => {
    const updateDto: UpdatePayrollDto = {
      allowances: '3000000',
      deductions: '1000000',
    };

    it('12. Sukses update allowances/deductions saat masih DRAFT dengan re-kalkulasi netSalary yang benar', async () => {
      payrollRepository.findById = jest
        .fn()
        .mockResolvedValueOnce(mockDraftPayroll)
        .mockResolvedValueOnce({
          ...mockDraftPayroll,
          allowances: new Prisma.Decimal(3000000),
          deductions: new Prisma.Decimal(1000000),
          netSalary: new Prisma.Decimal(12000000),
        });
      payrollRepository.updateDraftIf = jest.fn().mockResolvedValue(1);

      const result = await payrollService.update('payroll-uuid-1', updateDto);

      expect(result?.allowances).toEqual(new Prisma.Decimal(3000000));
      expect(result?.deductions).toEqual(new Prisma.Decimal(1000000));
      expect(payrollRepository.updateDraftIf).toHaveBeenCalledWith('payroll-uuid-1', {
        allowances: new Prisma.Decimal(3000000),
        deductions: new Prisma.Decimal(1000000),
        netSalary: new Prisma.Decimal(12000000), // 10,000,000 + 3,000,000 - 1,000,000
      });
    });

    it('13. Gagal update: status PROCESSED atau PAID melempar ConflictException (immutability guard)', async () => {
      payrollRepository.findById = jest.fn().mockResolvedValue({
        ...mockDraftPayroll,
        status: PayrollStatus.PAID,
      });

      await expect(payrollService.update('payroll-uuid-1', updateDto)).rejects.toThrow(
        ConflictException,
      );
      expect(payrollRepository.updateDraftIf).not.toHaveBeenCalled();
    });

    it('14. Gagal update: ID tidak ditemukan melempar NotFoundException', async () => {
      payrollRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(payrollService.update('non-existent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove()', () => {
    it('15. Sukses hapus payroll saat status masih DRAFT', async () => {
      payrollRepository.deleteDraftIf = jest.fn().mockResolvedValue(1);

      const result = await payrollService.remove('payroll-uuid-1');

      expect(result).toEqual({ message: 'Payroll berhasil dihapus' });
      expect(payrollRepository.deleteDraftIf).toHaveBeenCalledWith('payroll-uuid-1');
    });

    it('16. Gagal hapus: status PROCESSED atau PAID melempar ConflictException', async () => {
      payrollRepository.deleteDraftIf = jest.fn().mockResolvedValue(0);
      payrollRepository.findById = jest.fn().mockResolvedValue({
        ...mockDraftPayroll,
        status: PayrollStatus.PROCESSED,
      });

      await expect(payrollService.remove('payroll-uuid-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('17. Gagal hapus: ID tidak ditemukan melempar NotFoundException', async () => {
      payrollRepository.deleteDraftIf = jest.fn().mockResolvedValue(0);
      payrollRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(payrollService.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
