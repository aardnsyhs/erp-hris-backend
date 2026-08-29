import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { EmergencyContactService } from './emergency-contact.service';
import { EmergencyContactRepository } from './emergency-contact.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';

describe('EmergencyContactService', () => {
  let service: EmergencyContactService;
  let repository: jest.Mocked<Partial<EmergencyContactRepository>>;
  let auditLogService: jest.Mocked<Partial<AuditLogService>>;

  const mockDepartmentEng = {
    id: 'dept-eng-uuid',
    code: 'ENG',
    name: 'Engineering',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDepartmentHr = {
    id: 'dept-hr-uuid',
    code: 'HR',
    name: 'Human Resources',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEmployee = {
    id: 'emp-1',
    departmentId: 'dept-eng-uuid',
    nip: 'EMP001',
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '+628123456789',
    jobTitle: 'Software Engineer',
    hireDate: new Date('2024-01-01'),
    baseSalary: {} as any,
    status: 'ACTIVE' as any,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    department: mockDepartmentEng,
  };

  const mockManagerEmployee = {
    ...mockEmployee,
    id: 'emp-mgr-1',
    departmentId: 'dept-eng-uuid',
    fullName: 'Manager John',
  };

  const mockOtherManagerEmployee = {
    ...mockEmployee,
    id: 'emp-mgr-2',
    departmentId: 'dept-hr-uuid',
    department: mockDepartmentHr,
    fullName: 'Manager HR',
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@example.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin',
  };

  const employeeUser: AuthenticatedUser = {
    userId: 'user-emp-1',
    email: 'john@example.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-1',
  };

  const otherEmployeeUser: AuthenticatedUser = {
    userId: 'user-emp-2',
    email: 'other@example.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-2',
  };

  const managerSameDeptUser: AuthenticatedUser = {
    userId: 'user-mgr-1',
    email: 'mgr.eng@example.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-mgr-1',
  };

  const managerOtherDeptUser: AuthenticatedUser = {
    userId: 'user-mgr-2',
    email: 'mgr.hr@example.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-mgr-2',
  };

  const mockContact = {
    id: 'contact-1',
    employeeId: 'emp-1',
    name: 'Jane Doe',
    relationship: 'Spouse',
    phone: '+628987654321',
    email: 'jane@example.com',
    isPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      findEmployeeById: jest.fn(),
      countByEmployeeId: jest.fn(),
      findByEmployeeId: jest.fn(),
      findById: jest.fn(),
      resetPrimaryForEmployee: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    auditLogService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyContactService,
        { provide: EmergencyContactRepository, useValue: repository },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<EmergencyContactService>(EmergencyContactService);
  });

  describe('create()', () => {
    const createDto: CreateEmergencyContactDto = {
      name: 'Jane Doe',
      relationship: 'Spouse',
      phone: '+628987654321',
      email: 'jane@example.com',
    };

    it('1. Sukses membuat kontak pertama (otomatis menjadi isPrimary: true)', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.countByEmployeeId.mockResolvedValue(0);
      repository.create.mockResolvedValue(mockContact as any);

      const result = await service.create('emp-1', createDto, employeeUser);

      expect(result).toEqual(mockContact);
      expect(repository.create).toHaveBeenCalledWith({
        employeeId: 'emp-1',
        name: createDto.name,
        relationship: createDto.relationship,
        phone: createDto.phone,
        email: createDto.email,
        isPrimary: true,
      });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_EMERGENCY_CONTACT',
          entity: 'EmployeeEmergencyContact',
          entityId: mockContact.id,
        }),
      );
    });

    it('2. Sukses membuat kontak baru dengan isPrimary=true -> reset primary kontak lama', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.countByEmployeeId.mockResolvedValue(1);
      repository.create.mockResolvedValue({
        ...mockContact,
        id: 'contact-2',
        isPrimary: true,
      } as any);

      const result = await service.create(
        'emp-1',
        { ...createDto, isPrimary: true },
        employeeUser,
      );

      expect(repository.resetPrimaryForEmployee).toHaveBeenCalledWith('emp-1');
      expect(result.id).toBe('contact-2');
    });

    it('3. Gagal jika jumlah kontak sudah 3 -> melempar BadRequestException', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.countByEmployeeId.mockResolvedValue(3);

      await expect(
        service.create('emp-1', createDto, employeeUser),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('4. Gagal jika employee tidak ditemukan -> melempar NotFoundException', async () => {
      repository.findEmployeeById.mockResolvedValue(null);

      await expect(
        service.create('emp-1', createDto, hrAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('5. Gagal jika role EMPLOYEE mencoba create untuk employeeId lain -> ForbiddenException', async () => {
      await expect(
        service.create('emp-1', createDto, otherEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('6. Gagal jika role MANAGER mencoba create kontak darurat -> ForbiddenException', async () => {
      await expect(
        service.create('emp-1', createDto, managerSameDeptUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('7. Non-blocking: create tetap sukses meskipun auditLog recording gagal', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.countByEmployeeId.mockResolvedValue(0);
      repository.create.mockResolvedValue(mockContact as any);
      auditLogService.record.mockResolvedValue(null);

      const result = await service.create('emp-1', createDto, employeeUser);
      expect(result).toEqual(mockContact);
    });
  });

  describe('findByEmployeeId()', () => {
    it('8. Sukses diambil oleh HR_ADMIN untuk sembarang karyawan', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findByEmployeeId.mockResolvedValue([mockContact as any]);

      const result = await service.findByEmployeeId('emp-1', hrAdminUser);
      expect(result.data).toEqual([mockContact]);
    });

    it('9. Sukses diambil oleh EMPLOYEE untuk dirinya sendiri', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findByEmployeeId.mockResolvedValue([mockContact as any]);

      const result = await service.findByEmployeeId('emp-1', employeeUser);
      expect(result.data).toEqual([mockContact]);
    });

    it('10. Gagal diambil oleh EMPLOYEE untuk karyawan lain -> ForbiddenException', async () => {
      await expect(
        service.findByEmployeeId('emp-1', otherEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('11. Sukses diambil oleh MANAGER untuk karyawan di departemen yang sama', async () => {
      repository.findEmployeeById.mockImplementation(async (id) => {
        if (id === 'emp-1') return mockEmployee as any;
        if (id === 'emp-mgr-1') return mockManagerEmployee as any;
        return null;
      });
      repository.findByEmployeeId.mockResolvedValue([mockContact as any]);

      const result = await service.findByEmployeeId(
        'emp-1',
        managerSameDeptUser,
      );
      expect(result.data).toEqual([mockContact]);
    });

    it('12. Gagal diambil oleh MANAGER untuk karyawan di departemen berbeda -> ForbiddenException', async () => {
      repository.findEmployeeById.mockImplementation(async (id) => {
        if (id === 'emp-1') return mockEmployee as any;
        if (id === 'emp-mgr-2') return mockOtherManagerEmployee as any;
        return null;
      });

      await expect(
        service.findByEmployeeId('emp-1', managerOtherDeptUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update()', () => {
    const updateDto: UpdateEmergencyContactDto = {
      phone: '+628111222333',
      isPrimary: true,
    };

    it('13. Sukses mengupdate kontak darurat', async () => {
      repository.findById.mockResolvedValue(mockContact as any);
      const updatedContact = { ...mockContact, phone: '+628111222333' };
      repository.update.mockResolvedValue(updatedContact as any);

      const result = await service.update(
        'emp-1',
        'contact-1',
        updateDto,
        employeeUser,
      );

      expect(repository.resetPrimaryForEmployee).toHaveBeenCalledWith(
        'emp-1',
        'contact-1',
      );
      expect(result.phone).toBe('+628111222333');
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_EMERGENCY_CONTACT',
          entity: 'EmployeeEmergencyContact',
          entityId: 'contact-1',
        }),
      );
    });

    it('14. Gagal update jika contact ID tidak ditemukan / bukan milik employeeId -> NotFoundException', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('emp-1', 'contact-999', updateDto, employeeUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('15. Gagal jika role MANAGER mencoba update -> ForbiddenException', async () => {
      await expect(
        service.update('emp-1', 'contact-1', updateDto, managerSameDeptUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete()', () => {
    it('16. Sukses menghapus kontak darurat', async () => {
      repository.findById.mockResolvedValue(mockContact as any);
      repository.delete.mockResolvedValue(mockContact as any);

      const result = await service.delete('emp-1', 'contact-1', employeeUser);

      expect(result).toEqual({ message: 'Kontak darurat berhasil dihapus' });
      expect(repository.delete).toHaveBeenCalledWith('contact-1');
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_EMERGENCY_CONTACT',
          entity: 'EmployeeEmergencyContact',
          entityId: 'contact-1',
        }),
      );
    });

    it('17. Gagal delete jika contact ID tidak ditemukan -> NotFoundException', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.delete('emp-1', 'contact-999', employeeUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
