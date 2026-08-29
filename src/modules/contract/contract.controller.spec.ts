import { Test, TestingModule } from '@nestjs/testing';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractStatus, ContractType, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('ContractController', () => {
  let controller: ContractController;
  let service: ContractService;

  const mockService = {
    create: jest.fn(),
    findByEmployeeId: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@company.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractController],
      providers: [
        {
          provide: ContractService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ContractController>(ContractController);
    service = module.get<ContractService>(ContractService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create()', () => {
    it('should delegate to service.create', async () => {
      const dto = {
        contractType: ContractType.CONTRACT,
        contractNumber: 'CTR/001',
        startDate: '2026-01-01',
      };
      mockService.create.mockResolvedValue({ id: 'ctr-1', ...dto });

      const result = await controller.create('emp-1', dto, hrAdminUser);
      expect(mockService.create).toHaveBeenCalledWith('emp-1', dto, hrAdminUser);
      expect(result.id).toBe('ctr-1');
    });
  });

  describe('findMany()', () => {
    it('should delegate to service.findByEmployeeId', async () => {
      mockService.findByEmployeeId.mockResolvedValue({ data: [] });

      const result = await controller.findMany('emp-1', hrAdminUser);
      expect(mockService.findByEmployeeId).toHaveBeenCalledWith(
        'emp-1',
        hrAdminUser,
      );
      expect(result).toEqual({ data: [] });
    });
  });

  describe('findById()', () => {
    it('should delegate to service.findById', async () => {
      mockService.findById.mockResolvedValue({ id: 'ctr-1' });

      const result = await controller.findById('emp-1', 'ctr-1', hrAdminUser);
      expect(mockService.findById).toHaveBeenCalledWith(
        'emp-1',
        'ctr-1',
        hrAdminUser,
      );
      expect(result.id).toBe('ctr-1');
    });
  });

  describe('updateStatus()', () => {
    it('should delegate to service.updateStatus', async () => {
      const dto = { status: ContractStatus.TERMINATED };
      mockService.updateStatus.mockResolvedValue({ id: 'ctr-1', ...dto });

      const result = await controller.updateStatus(
        'emp-1',
        'ctr-1',
        dto,
        hrAdminUser,
      );
      expect(mockService.updateStatus).toHaveBeenCalledWith(
        'emp-1',
        'ctr-1',
        dto,
        hrAdminUser,
      );
      expect(result.id).toBe('ctr-1');
    });
  });
});
