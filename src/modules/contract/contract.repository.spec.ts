import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ContractStatus, ContractType } from '@prisma/client';
import { ContractRepository } from './contract.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('ContractRepository', () => {
  let repository: ContractRepository;
  let prisma: PrismaService;

  const mockTx = {
    employmentContract: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const existingActiveContract = {
    id: 'ctr-1',
    employeeId: 'emp-1',
    contractNumber: 'CTR/2026/001',
    contractType: ContractType.CONTRACT,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: ContractStatus.ACTIVE,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractRepository,
        {
          provide: PrismaService,
          useValue: {
            employmentContract: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            employee: {
              findUnique: jest.fn(),
            },
            employeeDocument: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(mockTx)),
          },
        },
      ],
    }).compile();

    repository = module.get<ContractRepository>(ContractRepository);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('createWithOverlapCheckTransaction()', () => {
    it('1. Sukses membuat kontrak baru saat tidak ada overlap dalam tx', async () => {
      mockTx.employmentContract.findMany.mockResolvedValue([]);
      const newContract = {
        id: 'ctr-2',
        employeeId: 'emp-1',
        contractNumber: 'CTR/2027/001',
        contractType: ContractType.CONTRACT,
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-12-31'),
        status: ContractStatus.ACTIVE,
      };
      mockTx.employmentContract.create.mockResolvedValue(newContract);

      const result = await repository.createWithOverlapCheckTransaction(newContract as any);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.employmentContract.create).toHaveBeenCalledWith({
        data: newContract,
        include: { document: true },
      });
      expect(result).toEqual(newContract);
    });

    it('2. Gagal dan rollback saat terdeteksi overlap dengan kontrak ACTIVE lain dalam tx', async () => {
      mockTx.employmentContract.findMany.mockResolvedValue([existingActiveContract]);

      const overlappingInput = {
        employeeId: 'emp-1',
        contractNumber: 'CTR/2026/002',
        contractType: ContractType.CONTRACT,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-06-01'),
        status: ContractStatus.ACTIVE,
      };

      await expect(
        repository.createWithOverlapCheckTransaction(overlappingInput as any),
      ).rejects.toThrow(ConflictException);

      expect(mockTx.employmentContract.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatusWithOverlapCheckTransaction()', () => {
    it('3. Sukses mengupdate status kontrak', async () => {
      mockTx.employmentContract.findUnique.mockResolvedValue(existingActiveContract);
      const updated = { ...existingActiveContract, status: ContractStatus.TERMINATED };
      mockTx.employmentContract.update.mockResolvedValue(updated);

      const result = await repository.updateStatusWithOverlapCheckTransaction(
        'ctr-1',
        'emp-1',
        ContractStatus.TERMINATED,
        'Ended early',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.status).toBe(ContractStatus.TERMINATED);
    });
  });
});
