import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { DepartmentStatusFilter } from './dto/department-query.dto';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('DepartmentController', () => {
  let controller: DepartmentController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    getTree: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    archive: jest.Mock;
    restore: jest.Mock;
    remove: jest.Mock;
    reparentDepartment: jest.Mock;
  };
  let reflector: Reflector;

  const mockAdminUser: AuthenticatedUser = {
    userId: 'user-admin-1',
    email: 'admin@hris.local',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-1',
  };

  const mockDepartment = {
    id: 'dept-1',
    code: 'ENG',
    name: 'Engineering',
    isActive: true,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      getTree: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      restore: jest.fn(),
      remove: jest.fn(),
      reparentDepartment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentController],
      providers: [
        { provide: DepartmentService, useValue: service },
        Reflector,
      ],
    }).compile();

    controller = module.get<DepartmentController>(DepartmentController);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll()', () => {
    it('mendelegasikan ke service.findAll dengan parameter query', async () => {
      const mockResult = { data: [mockDepartment], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } };
      service.findAll.mockResolvedValue(mockResult as any);

      const query = { page: 1, limit: 10, status: DepartmentStatusFilter.ACTIVE };
      const result = await controller.findAll(query);

      expect(result).toBe(mockResult);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('getTree()', () => {
    it('mendelegasikan ke service.getTree dengan parameter query', async () => {
      const mockTree = [{ ...mockDepartment, level: 0, parentId: null, children: [] }];
      service.getTree.mockResolvedValue(mockTree as any);

      const query = { includeArchived: true };
      const result = await controller.getTree(query);

      expect(result).toBe(mockTree);
      expect(service.getTree).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne()', () => {
    it('mendelegasikan ke service.findById', async () => {
      service.findById.mockResolvedValue(mockDepartment as any);

      const result = await controller.findOne('dept-1');

      expect(result).toBe(mockDepartment);
      expect(service.findById).toHaveBeenCalledWith('dept-1');
    });
  });

  describe('create()', () => {
    it('memiliki proteksi role HR_ADMIN dan mendelegasikan ke service.create', async () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.create);
      expect(roles).toEqual([UserRole.HR_ADMIN]);

      service.create.mockResolvedValue(mockDepartment as any);
      const dto = { code: 'ENG', name: 'Engineering' };

      const result = await controller.create(dto);

      expect(result).toBe(mockDepartment);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('archive()', () => {
    it('memiliki proteksi role HR_ADMIN dan mendelegasikan ke service.archive', async () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.archive);
      expect(roles).toEqual([UserRole.HR_ADMIN]);

      const archivedMock = { ...mockDepartment, isActive: false, archivedAt: new Date() };
      service.archive.mockResolvedValue(archivedMock as any);

      const dto = { reason: 'Restrukturisasi' };
      const result = await controller.archive('dept-1', dto, mockAdminUser);

      expect(result).toBe(archivedMock);
      expect(service.archive).toHaveBeenCalledWith('dept-1', dto, mockAdminUser);
    });
  });

  describe('restore()', () => {
    it('memiliki proteksi role HR_ADMIN dan mendelegasikan ke service.restore', async () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.restore);
      expect(roles).toEqual([UserRole.HR_ADMIN]);

      const restoredMock = { ...mockDepartment, isActive: true, archivedAt: null };
      service.restore.mockResolvedValue(restoredMock as any);

      const dto = { reason: 'Diaktifkan kembali' };
      const result = await controller.restore('dept-1', dto, mockAdminUser);

      expect(result).toBe(restoredMock);
      expect(service.restore).toHaveBeenCalledWith('dept-1', dto, mockAdminUser);
    });
  });

  describe('remove()', () => {
    it('memiliki proteksi role HR_ADMIN dan mendelegasikan ke service.remove', async () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.remove);
      expect(roles).toEqual([UserRole.HR_ADMIN]);

      const deleteResponse = { message: 'Departemen berhasil dihapus' };
      service.remove.mockResolvedValue(deleteResponse);

      const result = await controller.remove('dept-1');

      expect(result).toBe(deleteResponse);
      expect(service.remove).toHaveBeenCalledWith('dept-1');
    });
  });

  describe('reparent()', () => {
    it('memiliki proteksi role HR_ADMIN dan mendelegasikan ke service.reparentDepartment', async () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, controller.reparent);
      expect(roles).toEqual([UserRole.HR_ADMIN]);

      const reparentedMock = {
        ...mockDepartment,
        parentId: 'parent-dept-id',
        level: 1,
      };
      service.reparentDepartment.mockResolvedValue(reparentedMock as any);

      const dto = {
        parentId: 'parent-dept-id',
        reason: 'Restrukturisasi Q3',
      };
      const result = await controller.reparent('dept-1', dto, mockAdminUser);

      expect(result).toBe(reparentedMock);
      expect(service.reparentDepartment).toHaveBeenCalledWith(
        'dept-1',
        dto,
        mockAdminUser,
      );
    });
  });
});
