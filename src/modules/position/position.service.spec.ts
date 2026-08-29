import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PositionService } from './position.service';
import { PositionRepository } from './position.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('PositionService', () => {
  let service: PositionService;
  let repository: Record<keyof PositionRepository, jest.Mock>;
  let auditLogService: Record<keyof AuditLogService, jest.Mock>;

  const mockPosition = {
    id: 'pos-1',
    code: 'ENG-SR',
    title: 'Senior Engineer',
    description: 'Senior software engineering role',
    level: 3,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@company.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin',
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      findMany: jest.fn(),
    } as any;

    auditLogService = {
      record: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionService,
        {
          provide: PositionRepository,
          useValue: repository,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
      ],
    }).compile();

    service = module.get<PositionService>(PositionService);
  });

  describe('create()', () => {
    it('1. Sukses membuat posisi baru dan mencatat audit log', async () => {
      repository.findByCode.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockPosition as any);

      const dto = {
        code: 'ENG-SR',
        title: 'Senior Engineer',
        description: 'Senior software engineering role',
        level: 3,
        isActive: true,
      };

      const result = await service.create(dto, hrAdminUser);

      expect(repository.findByCode).toHaveBeenCalledWith('ENG-SR');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ENG-SR',
          title: 'Senior Engineer',
          level: 3,
        }),
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_POSITION',
          entity: 'Position',
          entityId: 'pos-1',
        }),
      );
      expect(result).toEqual(mockPosition);
    });

    it('2. Gagal jika kode posisi sudah digunakan -> ConflictException', async () => {
      repository.findByCode.mockResolvedValue(mockPosition as any);

      await expect(
        service.create(
          {
            code: 'ENG-SR',
            title: 'Senior Engineer Duplicate',
            level: 3,
          },
          hrAdminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update()', () => {
    it('3. Sukses mengupdate data posisi dan mencatat audit log', async () => {
      repository.findById.mockResolvedValue(mockPosition as any);
      repository.findByCode.mockResolvedValue(null);
      const updated = { ...mockPosition, title: 'Lead Engineer', level: 4 };
      repository.update.mockResolvedValue(updated as any);

      const result = await service.update(
        'pos-1',
        { title: 'Lead Engineer', level: 4 },
        hrAdminUser,
      );

      expect(repository.update).toHaveBeenCalledWith('pos-1', {
        title: 'Lead Engineer',
        level: 4,
        code: undefined,
        description: undefined,
        isActive: undefined,
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_POSITION',
          entity: 'Position',
          entityId: 'pos-1',
        }),
      );
      expect(result.title).toBe('Lead Engineer');
    });

    it('4. Gagal jika posisi tidak ditemukan -> NotFoundException', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('pos-999', { title: 'Non Existent' }, hrAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('5. Gagal jika kode baru bentrok dengan posisi lain -> ConflictException', async () => {
      repository.findById.mockResolvedValue(mockPosition as any);
      repository.findByCode.mockResolvedValue({
        id: 'pos-2',
        code: 'ENG-LEAD',
      } as any);

      await expect(
        service.update('pos-1', { code: 'ENG-LEAD' }, hrAdminUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById() and findMany()', () => {
    it('6. Sukses mengambil detail posisi berdasarkan ID', async () => {
      repository.findById.mockResolvedValue(mockPosition as any);

      const result = await service.findById('pos-1');
      expect(result).toEqual(mockPosition);
    });

    it('7. Sukses mengambil daftar master posisi', async () => {
      repository.findMany.mockResolvedValue([mockPosition as any]);

      const result = await service.findMany({ isActive: true });
      expect(result.data).toHaveLength(1);
    });
  });
});
