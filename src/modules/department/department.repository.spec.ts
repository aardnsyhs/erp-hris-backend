import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentRepository } from './department.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentStatusFilter } from './dto/department-query.dto';

describe('DepartmentRepository', () => {
  let repository: DepartmentRepository;
  let prisma: {
    department: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    employee: {
      count: jest.Mock;
    };
    employeePositionAssignment: {
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      department: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      employee: {
        count: jest.fn(),
      },
      employeePositionAssignment: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<DepartmentRepository>(DepartmentRepository);
  });

  describe('findAll()', () => {
    it('1. Memfilter isActive: true secara default jika status adalah ACTIVE atau tidak ditentukan', async () => {
      prisma.department.findMany.mockResolvedValue([]);

      await repository.findAll({ skip: 0, take: 10, status: DepartmentStatusFilter.ACTIVE });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('2. Memfilter isActive: false jika status adalah ARCHIVED', async () => {
      prisma.department.findMany.mockResolvedValue([]);

      await repository.findAll({ skip: 0, take: 10, status: DepartmentStatusFilter.ARCHIVED });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: false },
        }),
      );
    });

    it('3. Tidak memfilter isActive jika status adalah ALL', async () => {
      prisma.department.findMany.mockResolvedValue([]);

      await repository.findAll({ skip: 0, take: 10, status: DepartmentStatusFilter.ALL });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('4. Menggabungkan filter status dan kata kunci pencarian search', async () => {
      prisma.department.findMany.mockResolvedValue([]);

      await repository.findAll({
        skip: 0,
        take: 10,
        search: 'Eng',
        status: DepartmentStatusFilter.ACTIVE,
      });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            OR: [
              { name: { contains: 'Eng', mode: 'insensitive' } },
              { code: { contains: 'Eng', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('countAll()', () => {
    it('1. Menghitung total dengan filter isActive: true untuk ACTIVE', async () => {
      prisma.department.count.mockResolvedValue(5);

      const count = await repository.countAll({ status: DepartmentStatusFilter.ACTIVE });

      expect(count).toBe(5);
      expect(prisma.department.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
    });

    it('2. Menghitung total dengan filter isActive: false untuk ARCHIVED', async () => {
      prisma.department.count.mockResolvedValue(2);

      const count = await repository.countAll({ status: DepartmentStatusFilter.ARCHIVED });

      expect(count).toBe(2);
      expect(prisma.department.count).toHaveBeenCalledWith({
        where: { isActive: false },
      });
    });

    it('3. Menghitung total tanpa filter isActive untuk ALL', async () => {
      prisma.department.count.mockResolvedValue(7);

      const count = await repository.countAll({ status: DepartmentStatusFilter.ALL });

      expect(count).toBe(7);
      expect(prisma.department.count).toHaveBeenCalledWith({
        where: {},
      });
    });
  });

  describe('archive()', () => {
    it('Mengubah status isActive menjadi false dan mengisi archivedAt', async () => {
      const mockResult = { id: 'dept-1', isActive: false, archivedAt: new Date() };
      prisma.department.update.mockResolvedValue(mockResult);

      const result = await repository.archive('dept-1');

      expect(result).toBe(mockResult);
      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        data: {
          isActive: false,
          archivedAt: expect.any(Date),
        },
      });
    });
  });

  describe('restore()', () => {
    it('Mengubah status isActive menjadi true dan mengosongkan archivedAt menjadi null', async () => {
      const mockResult = { id: 'dept-1', isActive: true, archivedAt: null };
      prisma.department.update.mockResolvedValue(mockResult);

      const result = await repository.restore('dept-1');

      expect(result).toBe(mockResult);
      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: 'dept-1' },
        data: {
          isActive: true,
          archivedAt: null,
        },
      });
    });
  });
});
