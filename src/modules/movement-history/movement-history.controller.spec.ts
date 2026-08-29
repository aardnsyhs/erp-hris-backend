import { Test, TestingModule } from '@nestjs/testing';
import { MovementHistoryController } from './movement-history.controller';
import { MovementHistoryService } from './movement-history.service';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('MovementHistoryController', () => {
  let controller: MovementHistoryController;
  let service: MovementHistoryService;

  const mockService = {
    findByEmployeeId: jest.fn(),
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@company.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MovementHistoryController],
      providers: [
        {
          provide: MovementHistoryService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<MovementHistoryController>(
      MovementHistoryController,
    );
    service = module.get<MovementHistoryService>(MovementHistoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findByEmployeeId()', () => {
    it('should delegate to service.findByEmployeeId', async () => {
      mockService.findByEmployeeId.mockResolvedValue({ data: [] });

      const result = await controller.findByEmployeeId('emp-1', hrAdminUser);
      expect(mockService.findByEmployeeId).toHaveBeenCalledWith(
        'emp-1',
        hrAdminUser,
      );
      expect(result).toEqual({ data: [] });
    });
  });
});
