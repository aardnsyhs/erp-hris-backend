import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentRepository } from './department.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

describe('DepartmentService', () => {
  let departmentService: DepartmentService;
  let departmentRepository: jest.Mocked<Partial<DepartmentRepository>>;

  const mockDepartment = {
    id: 'dept-uuid-1',
    code: 'ENG',
    name: 'Engineering',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    departmentRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      countAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countActiveEmployees: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        { provide: DepartmentRepository, useValue: departmentRepository },
      ],
    }).compile();

    departmentService = module.get<DepartmentService>(DepartmentService);
  });

  describe('create()', () => {
    const createDto: CreateDepartmentDto = {
      code: 'HR',
      name: 'Human Resources',
    };

    it('1. Sukses membuat departemen baru', async () => {
      departmentRepository.findByCode = jest.fn().mockResolvedValue(null);
      departmentRepository.create = jest.fn().mockResolvedValue({
        id: 'dept-uuid-2',
        ...createDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await departmentService.create(createDto);

      expect(result).toBeDefined();
      expect(result.code).toBe('HR');
      expect(departmentRepository.findByCode).toHaveBeenCalledWith('HR');
      expect(departmentRepository.create).toHaveBeenCalledWith(createDto);
    });

    it('2. Gagal: kode departemen sudah terdaftar melempar ConflictException', async () => {
      departmentRepository.findByCode = jest.fn().mockResolvedValue(mockDepartment);

      await expect(departmentService.create({ code: 'ENG', name: 'Engineering 2' })).rejects.toThrow(
        ConflictException,
      );
      expect(departmentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('3. Mengembalikan list departemen beserta metadata pagination', async () => {
      departmentRepository.findAll = jest.fn().mockResolvedValue([mockDepartment]);
      departmentRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await departmentService.findAll({ page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(departmentRepository.findAll).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        search: undefined,
      });
    });
  });

  describe('findById()', () => {
    it('4. Sukses mengembalikan detail departemen berdasarkan ID', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);

      const result = await departmentService.findById('dept-uuid-1');

      expect(result).toEqual(mockDepartment);
      expect(departmentRepository.findById).toHaveBeenCalledWith('dept-uuid-1');
    });

    it('5. Gagal: ID departemen tidak ditemukan melempar NotFoundException', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(departmentService.findById('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    const updateDto: UpdateDepartmentDto = {
      name: 'Software Engineering',
    };

    it('6. Sukses mengupdate departemen', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);
      departmentRepository.update = jest.fn().mockResolvedValue({
        ...mockDepartment,
        name: 'Software Engineering',
      });

      const result = await departmentService.update('dept-uuid-1', updateDto);

      expect(result.name).toBe('Software Engineering');
      expect(departmentRepository.update).toHaveBeenCalledWith('dept-uuid-1', updateDto);
    });

    it('7. Gagal: update kode ke kode yang sudah dipakai departemen lain melempar ConflictException', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);
      departmentRepository.findByCode = jest.fn().mockResolvedValue({
        id: 'other-dept-id',
        code: 'FIN',
        name: 'Finance',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        departmentService.update('dept-uuid-1', { code: 'FIN' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove()', () => {
    it('8. Sukses menghapus departemen jika tidak ada karyawan aktif (count = 0)', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);
      departmentRepository.countActiveEmployees = jest.fn().mockResolvedValue(0);
      departmentRepository.delete = jest.fn().mockResolvedValue(mockDepartment);

      const result = await departmentService.remove('dept-uuid-1');

      expect(result).toEqual({ message: 'Departemen berhasil dihapus' });
      expect(departmentRepository.delete).toHaveBeenCalledWith('dept-uuid-1');
    });

    it('9. Gagal: menolak penghapusan jika masih ada karyawan aktif melempar BadRequestException', async () => {
      departmentRepository.findById = jest.fn().mockResolvedValue(mockDepartment);
      departmentRepository.countActiveEmployees = jest.fn().mockResolvedValue(5);

      await expect(departmentService.remove('dept-uuid-1')).rejects.toThrow(BadRequestException);
      expect(departmentRepository.delete).not.toHaveBeenCalled();
    });
  });
});
