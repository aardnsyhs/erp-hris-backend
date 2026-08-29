import { Test, TestingModule } from '@nestjs/testing';
import { PositionController } from './position.controller';
import { PositionService } from './position.service';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('PositionController', () => {
  let controller: PositionController;
  let service: PositionService;

  const mockService = {
    create: jest.fn(),
    findMany: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@company.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PositionController],
      providers: [
        {
          provide: PositionService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<PositionController>(PositionController);
    service = module.get<PositionService>(PositionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create()', () => {
    it('should delegate to service.create', async () => {
      const dto = { code: 'ENG-1', title: 'Engineer', level: 1 };
      mockService.create.mockResolvedValue({ id: 'pos-1', ...dto });

      const result = await controller.create(dto, hrAdminUser);
      expect(mockService.create).toHaveBeenCalledWith(dto, hrAdminUser);
      expect(result.id).toBe('pos-1');
    });
  });

  describe('findMany()', () => {
    it('should delegate to service.findMany', async () => {
      mockService.findMany.mockResolvedValue({ data: [] });

      const result = await controller.findMany({});
      expect(mockService.findMany).toHaveBeenCalledWith({});
      expect(result).toEqual({ data: [] });
    });
  });

  describe('findById()', () => {
    it('should delegate to service.findById', async () => {
      mockService.findById.mockResolvedValue({ id: 'pos-1' });

      const result = await controller.findById('pos-1');
      expect(mockService.findById).toHaveBeenCalledWith('pos-1');
      expect(result.id).toBe('pos-1');
    });
  });

  describe('update()', () => {
    it('should delegate to service.update', async () => {
      const dto = { title: 'Updated Engineer' };
      mockService.update.mockResolvedValue({ id: 'pos-1', ...dto });

      const result = await controller.update('pos-1', dto, hrAdminUser);
      expect(mockService.update).toHaveBeenCalledWith(
        'pos-1',
        dto,
        hrAdminUser,
      );
      expect(result.id).toBe('pos-1');
    });
  });
});
