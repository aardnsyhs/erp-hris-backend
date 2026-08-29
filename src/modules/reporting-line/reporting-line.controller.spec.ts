import { Test, TestingModule } from '@nestjs/testing';
import { ReportingLineController } from './reporting-line.controller';
import { ReportingLineService } from './reporting-line.service';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('ReportingLineController', () => {
  let controller: ReportingLineController;
  let service: ReportingLineService;

  const mockService = {
    create: jest.fn(),
    findActiveByEmployeeId: jest.fn(),
    findHistoryByEmployeeId: jest.fn(),
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@company.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportingLineController],
      providers: [
        {
          provide: ReportingLineService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ReportingLineController>(ReportingLineController);
    service = module.get<ReportingLineService>(ReportingLineService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create()', () => {
    it('should delegate to service.create', async () => {
      const dto = {
        managerId: 'emp-mgr-1',
        effectiveFrom: '2026-01-01',
      };
      mockService.create.mockResolvedValue({ id: 'rep-1', ...dto });

      const result = await controller.create('emp-1', dto, hrAdminUser);
      expect(mockService.create).toHaveBeenCalledWith('emp-1', dto, hrAdminUser);
      expect(result.id).toBe('rep-1');
    });
  });

  describe('findActive()', () => {
    it('should delegate to service.findActiveByEmployeeId', async () => {
      mockService.findActiveByEmployeeId.mockResolvedValue({ id: 'rep-1' });

      const result = await controller.findActive('emp-1', hrAdminUser);
      expect(mockService.findActiveByEmployeeId).toHaveBeenCalledWith(
        'emp-1',
        hrAdminUser,
      );
      expect(result).toEqual({ id: 'rep-1' });
    });
  });

  describe('findHistory()', () => {
    it('should delegate to service.findHistoryByEmployeeId', async () => {
      mockService.findHistoryByEmployeeId.mockResolvedValue({ data: [] });

      const result = await controller.findHistory('emp-1', hrAdminUser);
      expect(mockService.findHistoryByEmployeeId).toHaveBeenCalledWith(
        'emp-1',
        hrAdminUser,
      );
      expect(result).toEqual({ data: [] });
    });
  });
});
