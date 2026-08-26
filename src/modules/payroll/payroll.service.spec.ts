import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PayrollStatus, Prisma, UserRole } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { PayrollRepository } from './payroll.repository';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('PayrollService', () => {
  let payrollService: PayrollService;
  let payrollRepository: jest.Mocked<Partial<PayrollRepository>>;

  const mockDepartmentEng = {
    id: 'dept-eng-uuid',
    code: 'ENG',
    name: 'Engineering',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDepartmentHr = {
    id: 'dept-hr-uuid',
    code: 'HR',
    name: 'Human Resources',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
    department: mockDepartmentEng,
  };

  const managerEmployee = {
    ...mockEmployee,
    id: 'emp-manager-eng-uuid',
    nip: 'MGR001',
    fullName: 'Eng Manager',
    email: 'manager.eng@example.com',
    jobTitle: 'Engineering Manager',
    department: mockDepartmentEng,
  };

  const otherDeptEmployee = {
    ...mockEmployee,
    id: 'emp-other-hr-uuid',
    departmentId: 'dept-hr-uuid',
    nip: 'HR001',
    fullName: 'HR Officer',
    email: 'hr@example.com',
    department: mockDepartmentHr,
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin-uuid',
    email: 'admin@example.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin-uuid',
  };

  const employeeUser: AuthenticatedUser = {
    userId: 'user-emp-uuid',
    email: 'john@example.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-uuid-1',
  };

  const managerUser: AuthenticatedUser = {
    userId: 'user-manager-uuid',
    email: 'manager.eng@example.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-manager-eng-uuid',
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

  const mockManagerPayroll = {
    id: 'payroll-manager-uuid',
    employeeId: 'emp-manager-eng-uuid',
    periodStart: new Date('2026-08-01'),
    periodEnd: new Date('2026-08-31'),
    basicSalary: new Prisma.Decimal(15000000),
    allowances: new Prisma.Decimal(3000000),
    deductions: new Prisma.Decimal(1000000),
    netSalary: new Prisma.Decimal(17000000),
    status: PayrollStatus.DRAFT,
    paymentDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    employee: managerEmployee,
  };

  beforeEach(async () => {
    payrollRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      countAll: jest.fn(),
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
      payrollRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(mockEmployee);
      payrollRepository.findByEmployeeAndPeriod = jest
        .fn()
        .mockResolvedValue(null);
      payrollRepository.create = jest.fn().mockResolvedValue(mockDraftPayroll);
      payrollRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDraftPayroll);

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
      payrollRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(mockEmployee);
      payrollRepository.findByEmployeeAndPeriod = jest
        .fn()
        .mockResolvedValue(null);
      payrollRepository.create = jest
        .fn()
        .mockImplementation((payload) => Promise.resolve(payload));
      payrollRepository.findById = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...mockDraftPayroll,
          netSalary: new Prisma.Decimal(-4000000),
        }),
      );

      const highDeductionDto: CreatePayrollDto = {
        employeeId: 'emp-uuid-1',
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        allowances: '1000000',
        deductions: '15000000',
      };

      const result = await payrollService.create(highDeductionDto);

      expect((result as any).netSalary).toEqual(new Prisma.Decimal(-4000000));
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
      payrollRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(mockEmployee);
      payrollRepository.findByEmployeeAndPeriod = jest
        .fn()
        .mockResolvedValue(mockDraftPayroll);

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

      const calledPaymentDate = (payrollRepository.updateStatusIf as jest.Mock)
        .mock.calls[0][3] as Date;
      expect(calledPaymentDate.getUTCHours()).toBe(0);
      expect(calledPaymentDate.getUTCMinutes()).toBe(0);
      expect(calledPaymentDate.getUTCSeconds()).toBe(0);
      expect(calledPaymentDate.getUTCMilliseconds()).toBe(0);
    });

    it('10. Gagal pay: status bukan PROCESSED (masih DRAFT) melempar ConflictException', async () => {
      payrollRepository.updateStatusIf = jest.fn().mockResolvedValue(0);
      payrollRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDraftPayroll);

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
      expect(payrollRepository.updateDraftIf).toHaveBeenCalledWith(
        'payroll-uuid-1',
        {
          allowances: new Prisma.Decimal(3000000),
          deductions: new Prisma.Decimal(1000000),
          netSalary: new Prisma.Decimal(12000000),
        },
      );
    });

    it('13. Gagal update: status PROCESSED atau PAID melempar ConflictException (immutability guard)', async () => {
      payrollRepository.findById = jest.fn().mockResolvedValue({
        ...mockDraftPayroll,
        status: PayrollStatus.PAID,
      });

      await expect(
        payrollService.update('payroll-uuid-1', updateDto),
      ).rejects.toThrow(ConflictException);
      expect(payrollRepository.updateDraftIf).not.toHaveBeenCalled();
    });

    it('14. Gagal update: ID tidak ditemukan melempar NotFoundException', async () => {
      payrollRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        payrollService.update('non-existent-id', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('15. Sukses hapus payroll saat status masih DRAFT', async () => {
      payrollRepository.deleteDraftIf = jest.fn().mockResolvedValue(1);

      const result = await payrollService.remove('payroll-uuid-1');

      expect(result).toEqual({ message: 'Payroll berhasil dihapus' });
      expect(payrollRepository.deleteDraftIf).toHaveBeenCalledWith(
        'payroll-uuid-1',
      );
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

  describe('findAll() & findById() (Tahap 8c Visibility & Field-Stripping)', () => {
    it('18. HR_ADMIN: melihat seluruh data payroll dengan nilai finansial lengkap', async () => {
      payrollRepository.findAll = jest
        .fn()
        .mockResolvedValue([mockDraftPayroll]);
      payrollRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await payrollService.findAll(
        { page: 1, limit: 10 },
        hrAdminUser,
      );

      expect(result.data).toHaveLength(1);
      const item = result.data[0] as any;
      expect(item.basicSalary).toBeDefined();
      expect(item.allowances).toBeDefined();
      expect(item.deductions).toBeDefined();
      expect(item.netSalary).toBeDefined();
    });

    it('19. EMPLOYEE: melihat data miliknya sendiri dengan nilai finansial lengkap', async () => {
      payrollRepository.findAll = jest
        .fn()
        .mockResolvedValue([mockDraftPayroll]);
      payrollRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await payrollService.findAll(
        { page: 1, limit: 10 },
        employeeUser,
      );

      expect(result.data).toHaveLength(1);
      const item = result.data[0] as any;
      expect(item.basicSalary).toBeDefined();
      expect(item.netSalary).toBeDefined();
      expect(payrollRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-uuid-1',
        }),
      );
    });

    it('20. EMPLOYEE: ditolak (ForbiddenException) saat mencoba melihat payroll karyawan lain', async () => {
      payrollRepository.findById = jest.fn().mockResolvedValue({
        ...mockDraftPayroll,
        employeeId: 'emp-other-uuid',
      });

      await expect(
        payrollService.findById('payroll-uuid-1', employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('21. MANAGER: melihat payroll anggota tim di departemennya dengan field finansial di-strip', async () => {
      payrollRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerEmployee);
      payrollRepository.findById = jest
        .fn()
        .mockResolvedValue(mockDraftPayroll); // employee is John Doe (different from manager)

      const result = await payrollService.findById(
        'payroll-uuid-1',
        managerUser,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('payroll-uuid-1');
      expect((result as any).basicSalary).toBeUndefined();
      expect((result as any).allowances).toBeUndefined();
      expect((result as any).deductions).toBeUndefined();
      expect((result as any).netSalary).toBeUndefined();
      expect(result.status).toBe(PayrollStatus.DRAFT);
    });

    it('22. MANAGER: ditolak (ForbiddenException) saat mencoba melihat payroll karyawan di departemen lain', async () => {
      payrollRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerEmployee);
      payrollRepository.findById = jest.fn().mockResolvedValue({
        ...mockDraftPayroll,
        employeeId: 'emp-other-hr-uuid',
        employee: otherDeptEmployee,
      });

      await expect(
        payrollService.findById('payroll-other-uuid', managerUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('23. MANAGER: melihat payroll miliknya sendiri -> menerima data finansial lengkap (self-access precedence)', async () => {
      payrollRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerEmployee);
      payrollRepository.findById = jest
        .fn()
        .mockResolvedValue(mockManagerPayroll);

      const result = await payrollService.findById(
        'payroll-manager-uuid',
        managerUser,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('payroll-manager-uuid');
      // Financial fields MUST be present for manager's own payroll
      expect((result as any).basicSalary).toBeDefined();
      expect((result as any).allowances).toBeDefined();
      expect((result as any).deductions).toBeDefined();
      expect((result as any).netSalary).toBeDefined();
      expect((result as any).netSalary).toEqual(new Prisma.Decimal(17000000));
    });
  });
});
