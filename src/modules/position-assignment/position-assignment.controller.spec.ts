import { Test, TestingModule } from '@nestjs/testing';
import { PositionAssignmentController } from './position-assignment.controller';
import { PositionAssignmentService } from './position-assignment.service';
import { AssignmentType, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('PositionAssignmentController', () => {
  let controller: PositionAssignmentController;
  let service: PositionAssignmentService;

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
      controllers: [PositionAssignmentController],
      providers: [
        {
          provide: PositionAssignmentService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<PositionAssignmentController>(
      PositionAssignmentController,
    );
    service = module.get<PositionAssignmentService>(PositionAssignmentService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create()', () => {
    it('should delegate to service.create', async () => {
      const dto = {
        positionId: 'pos-1',
        departmentId: 'dept-1',
        effectiveFrom: '2026-01-01',
        assignmentType: AssignmentType.INITIAL,
      };
      mockService.create.mockResolvedValue({ id: 'assign-1', ...dto });

      const result = await controller.create('emp-1', dto, hrAdminUser);
      expect(mockService.create).toHaveBeenCalledWith('emp-1', dto, hrAdminUser);
      expect(result.id).toBe('assign-1');
    });
  });

  describe('findActive()', () => {
    it('should delegate to service.findActiveByEmployeeId', async () => {
      mockService.findActiveByEmployeeId.mockResolvedValue({ id: 'assign-1' });

      const result = await controller.findActive('emp-1', hrAdminUser);
      expect(mockService.findActiveByEmployeeId).toHaveBeenCalledWith(
        'emp-1',
        hrAdminUser,
      );
      expect(result).toEqual({ id: 'assign-1' });
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
