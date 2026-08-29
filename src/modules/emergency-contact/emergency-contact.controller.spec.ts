import { Test, TestingModule } from '@nestjs/testing';
import { EmergencyContactController } from './emergency-contact.controller';
import { EmergencyContactService } from './emergency-contact.service';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('EmergencyContactController', () => {
  let controller: EmergencyContactController;
  let service: EmergencyContactService;

  const mockService = {
    create: jest.fn(),
    findByEmployeeId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@example.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmergencyContactController],
      providers: [
        {
          provide: EmergencyContactService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<EmergencyContactController>(
      EmergencyContactController,
    );
    service = module.get<EmergencyContactService>(EmergencyContactService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create()', () => {
    it('should delegate to service.create', async () => {
      const dto = {
        name: 'Jane Doe',
        relationship: 'Spouse',
        phone: '+628123456789',
      };
      mockService.create.mockResolvedValue({ id: 'contact-1', ...dto });

      const result = await controller.create('emp-1', dto, hrAdminUser);
      expect(mockService.create).toHaveBeenCalledWith('emp-1', dto, hrAdminUser);
      expect(result.id).toBe('contact-1');
    });
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

  describe('update()', () => {
    it('should delegate to service.update', async () => {
      const dto = { phone: '+628999999999' };
      mockService.update.mockResolvedValue({ id: 'contact-1', ...dto });

      const result = await controller.update(
        'emp-1',
        'contact-1',
        dto,
        hrAdminUser,
      );
      expect(mockService.update).toHaveBeenCalledWith(
        'emp-1',
        'contact-1',
        dto,
        hrAdminUser,
      );
      expect(result.id).toBe('contact-1');
    });
  });

  describe('delete()', () => {
    it('should delegate to service.delete', async () => {
      mockService.delete.mockResolvedValue({
        message: 'Kontak darurat berhasil dihapus',
      });

      const result = await controller.delete(
        'emp-1',
        'contact-1',
        hrAdminUser,
      );
      expect(mockService.delete).toHaveBeenCalledWith(
        'emp-1',
        'contact-1',
        hrAdminUser,
      );
      expect(result.message).toBe('Kontak darurat berhasil dihapus');
    });
  });
});
