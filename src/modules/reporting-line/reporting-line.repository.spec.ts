import { Test, TestingModule } from '@nestjs/testing';
import { ReportingLineRepository } from './reporting-line.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportingLineRepository', () => {
  let repository: ReportingLineRepository;
  let prisma: PrismaService;

  const mockTx = {
    employeeReportingLine: {
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingLineRepository,
        {
          provide: PrismaService,
          useValue: {
            employeeReportingLine: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              updateMany: jest.fn(),
              create: jest.fn(),
            },
            employee: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(mockTx)),
          },
        },
      ],
    }).compile();

    repository = module.get<ReportingLineRepository>(ReportingLineRepository);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createWithAutoCloseTransaction()', () => {
    it('1. Atomic Transaction: Sukses auto-close primary line lama & membuat reporting line baru dalam satu tx', async () => {
      const data = {
        employeeId: 'emp-1',
        managerId: 'emp-mgr-1',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        isPrimary: true,
      };

      const expected = { id: 'rep-1', ...data };

      mockTx.employeeReportingLine.updateMany.mockResolvedValue({ count: 1 });
      mockTx.employeeReportingLine.create.mockResolvedValue(expected);

      const result = await repository.createWithAutoCloseTransaction(
        'emp-1',
        data,
        true,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.employeeReportingLine.updateMany).toHaveBeenCalledWith({
        where: {
          employeeId: 'emp-1',
          isPrimary: true,
          effectiveTo: null,
        },
        data: {
          effectiveTo: data.effectiveFrom,
        },
      });
      expect(mockTx.employeeReportingLine.create).toHaveBeenCalledWith({
        data,
        include: { manager: true },
      });
      expect(result).toEqual(expected);
    });

    it('2. Atomic Rollback: Jika pembuatan line baru gagal, updateMany ikut rollback', async () => {
      const data = {
        employeeId: 'emp-1',
        managerId: 'emp-mgr-1',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        isPrimary: true,
      };

      mockTx.employeeReportingLine.updateMany.mockResolvedValue({ count: 1 });
      mockTx.employeeReportingLine.create.mockRejectedValue(
        new Error('DB Constraint Violation'),
      );

      await expect(
        repository.createWithAutoCloseTransaction('emp-1', data, true),
      ).rejects.toThrow('DB Constraint Violation');
    });
  });
});
