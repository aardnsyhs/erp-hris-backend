import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { FindAuditLogsQueryDto } from './dto/audit-log.dto';

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: AuditLogService;

  const mockAuditLogService = {
    findMany: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    controller = module.get<AuditLogController>(AuditLogController);
    service = module.get<AuditLogService>(AuditLogService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll()', () => {
    it('should return paginated audit logs with query filters', async () => {
      const mockResult = {
        data: [
          {
            id: 'audit-1',
            action: 'LOGIN',
            entity: 'User',
            entityId: 'user-1',
            createdAt: new Date(),
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };

      mockAuditLogService.findMany.mockResolvedValue(mockResult);

      const query: FindAuditLogsQueryDto = {
        entity: 'User',
        action: 'LOGIN',
        page: 1,
        limit: 20,
      };

      const result = await controller.findAll(query);

      expect(mockAuditLogService.findMany).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('findById()', () => {
    it('should return audit log detail when found', async () => {
      const mockLog = {
        id: 'audit-1',
        action: 'CREATE',
        entity: 'Employee',
      };

      mockAuditLogService.findById.mockResolvedValue(mockLog);

      const result = await controller.findById('audit-1');
      expect(mockAuditLogService.findById).toHaveBeenCalledWith('audit-1');
      expect(result).toEqual(mockLog);
    });

    it('should throw NotFoundException when log is not found', async () => {
      mockAuditLogService.findById.mockResolvedValue(null);

      await expect(controller.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
