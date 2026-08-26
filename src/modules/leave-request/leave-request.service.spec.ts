import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { LeaveRequestStatus, LeaveType, UserRole } from '@prisma/client';
import { LeaveRequestService } from './leave-request.service';
import { LeaveRequestRepository } from './leave-request.repository';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('LeaveRequestService', () => {
  let leaveRequestService: LeaveRequestService;
  let leaveRequestRepository: jest.Mocked<Partial<LeaveRequestRepository>>;

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

  const requesterEmployee = {
    id: 'emp-requester-uuid',
    departmentId: 'dept-eng-uuid',
    nip: 'EMP001',
    fullName: 'Requester Doe',
    email: 'requester@example.com',
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

  const managerSameDept = {
    ...requesterEmployee,
    id: 'emp-manager-eng-uuid',
    nip: 'MGR001',
    fullName: 'Eng Manager',
    email: 'manager.eng@example.com',
    jobTitle: 'Engineering Manager',
    department: mockDepartmentEng,
  };

  const managerOtherDept = {
    ...requesterEmployee,
    id: 'emp-manager-hr-uuid',
    departmentId: 'dept-hr-uuid',
    nip: 'MGR002',
    fullName: 'HR Manager',
    email: 'manager.hr@example.com',
    jobTitle: 'HR Manager',
    department: mockDepartmentHr,
  };

  const employeeUser: AuthenticatedUser = {
    userId: 'user-requester-uuid',
    email: 'requester@example.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-requester-uuid',
  };

  const managerSameDeptUser: AuthenticatedUser = {
    userId: 'user-manager-eng-uuid',
    email: 'manager.eng@example.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-manager-eng-uuid',
  };

  const managerOtherDeptUser: AuthenticatedUser = {
    userId: 'user-manager-hr-uuid',
    email: 'manager.hr@example.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-manager-hr-uuid',
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin-uuid',
    email: 'admin@example.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin-uuid',
  };

  const mockLeaveRequest = {
    id: 'lr-uuid-1',
    employeeId: 'emp-requester-uuid',
    leaveType: LeaveType.ANNUAL,
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-03'),
    reason: 'Annual family vacation',
    status: LeaveRequestStatus.PENDING,
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    employee: requesterEmployee,
    approver: null,
  };

  beforeEach(async () => {
    leaveRequestRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findOverlappingApproved: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      findAll: jest.fn(),
      countAll: jest.fn(),
      findEmployeeById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestService,
        { provide: LeaveRequestRepository, useValue: leaveRequestRepository },
      ],
    }).compile();

    leaveRequestService = module.get<LeaveRequestService>(LeaveRequestService);
  });

  describe('create()', () => {
    const createDto: CreateLeaveRequestDto = {
      leaveType: LeaveType.ANNUAL,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-03'),
      reason: 'Annual family vacation',
    };

    it('1. Sukses membuat permohonan cuti baru dengan status PENDING', async () => {
      leaveRequestRepository.findOverlappingApproved = jest
        .fn()
        .mockResolvedValue(null);
      leaveRequestRepository.create = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);

      const result = await leaveRequestService.create(employeeUser, createDto);

      expect(result).toBeDefined();
      expect(result.status).toBe(LeaveRequestStatus.PENDING);
      expect(
        leaveRequestRepository.findOverlappingApproved,
      ).toHaveBeenCalledWith(
        'emp-requester-uuid',
        createDto.startDate,
        createDto.endDate,
      );
      expect(leaveRequestRepository.create).toHaveBeenCalledWith({
        employeeId: 'emp-requester-uuid',
        leaveType: createDto.leaveType,
        startDate: createDto.startDate,
        endDate: createDto.endDate,
        reason: createDto.reason,
        status: LeaveRequestStatus.PENDING,
      });
    });

    it('2. Gagal: user tanpa employeeId melempar ForbiddenException', async () => {
      const userWithoutEmp: AuthenticatedUser = {
        ...employeeUser,
        employeeId: null,
      };

      await expect(
        leaveRequestService.create(userWithoutEmp, createDto),
      ).rejects.toThrow(ForbiddenException);
      expect(leaveRequestRepository.create).not.toHaveBeenCalled();
    });

    it('3. Gagal: endDate lebih awal dari startDate melempar BadRequestException', async () => {
      const invalidDateDto: CreateLeaveRequestDto = {
        ...createDto,
        startDate: new Date('2026-09-05'),
        endDate: new Date('2026-09-01'),
      };

      await expect(
        leaveRequestService.create(employeeUser, invalidDateDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. Gagal: terdapat overlapping approved leave melempar ConflictException', async () => {
      leaveRequestRepository.findOverlappingApproved = jest
        .fn()
        .mockResolvedValue({
          ...mockLeaveRequest,
          status: LeaveRequestStatus.APPROVED,
        });

      await expect(
        leaveRequestService.create(employeeUser, createDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('approve()', () => {
    it('5. Sukses approve oleh Manager di departemen yang sama', async () => {
      leaveRequestRepository.findById = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);
      leaveRequestRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerSameDept);
      leaveRequestRepository.approve = jest.fn().mockResolvedValue({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.APPROVED,
        approvedBy: managerSameDeptUser.employeeId,
      });

      const result = await leaveRequestService.approve(
        'lr-uuid-1',
        managerSameDeptUser,
      );

      expect(result.status).toBe(LeaveRequestStatus.APPROVED);
      expect(leaveRequestRepository.approve).toHaveBeenCalledWith(
        'lr-uuid-1',
        managerSameDeptUser.employeeId,
        expect.any(Date),
      );
    });

    it('6. Sukses approve oleh HR_ADMIN', async () => {
      leaveRequestRepository.findById = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);
      leaveRequestRepository.approve = jest.fn().mockResolvedValue({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.APPROVED,
        approvedBy: hrAdminUser.employeeId,
      });

      const result = await leaveRequestService.approve(
        'lr-uuid-1',
        hrAdminUser,
      );

      expect(result.status).toBe(LeaveRequestStatus.APPROVED);
      expect(leaveRequestRepository.approve).toHaveBeenCalledWith(
        'lr-uuid-1',
        hrAdminUser.employeeId,
        expect.any(Date),
      );
    });

    it('7. Gagal approve: status bukan PENDING melempar ConflictException', async () => {
      leaveRequestRepository.findById = jest.fn().mockResolvedValue({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.APPROVED,
      });

      await expect(
        leaveRequestService.approve('lr-uuid-1', managerSameDeptUser),
      ).rejects.toThrow(ConflictException);
    });

    it('8. Gagal approve: self-approval (pemohon menyetujui sendiri) melempar ForbiddenException', async () => {
      leaveRequestRepository.findById = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);

      await expect(
        leaveRequestService.approve('lr-uuid-1', employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('9. Gagal approve: Manager di departemen berbeda melempar ForbiddenException', async () => {
      leaveRequestRepository.findById = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);
      leaveRequestRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerOtherDept);

      await expect(
        leaveRequestService.approve('lr-uuid-1', managerOtherDeptUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reject()', () => {
    const rejectDto: RejectLeaveRequestDto = {
      rejectionReason: 'Understaffed during this sprint',
    };

    it('10. Sukses reject dengan rejectionReason', async () => {
      leaveRequestRepository.findById = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);
      leaveRequestRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerSameDept);
      leaveRequestRepository.reject = jest.fn().mockResolvedValue({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.REJECTED,
        rejectionReason: rejectDto.rejectionReason,
        approvedBy: managerSameDeptUser.employeeId,
      });

      const result = await leaveRequestService.reject(
        'lr-uuid-1',
        managerSameDeptUser,
        rejectDto,
      );

      expect(result.status).toBe(LeaveRequestStatus.REJECTED);
      expect(leaveRequestRepository.reject).toHaveBeenCalledWith(
        'lr-uuid-1',
        managerSameDeptUser.employeeId,
        expect.any(Date),
        rejectDto.rejectionReason,
      );
    });

    it('11. Gagal reject: self-rejection melempar ForbiddenException', async () => {
      leaveRequestRepository.findById = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);

      await expect(
        leaveRequestService.reject('lr-uuid-1', employeeUser, rejectDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('12. Gagal reject: status bukan PENDING melempar ConflictException', async () => {
      leaveRequestRepository.findById = jest.fn().mockResolvedValue({
        ...mockLeaveRequest,
        status: LeaveRequestStatus.REJECTED,
      });

      await expect(
        leaveRequestService.reject('lr-uuid-1', managerSameDeptUser, rejectDto),
      ).rejects.toThrow(ConflictException);
    });

    it('13. Gagal reject: Manager di departemen berbeda melempar ForbiddenException', async () => {
      leaveRequestRepository.findById = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);
      leaveRequestRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerOtherDept);

      await expect(
        leaveRequestService.reject(
          'lr-uuid-1',
          managerOtherDeptUser,
          rejectDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll()', () => {
    it('14. EMPLOYEE: dibatasi hanya melihat permohonan miliknya sendiri', async () => {
      leaveRequestRepository.findAll = jest
        .fn()
        .mockResolvedValue([mockLeaveRequest]);
      leaveRequestRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await leaveRequestService.findAll(
        { page: 1, limit: 10 },
        employeeUser,
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(leaveRequestRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-requester-uuid',
        }),
      );
    });

    it('15. MANAGER: dibatasi hanya melihat permohonan karyawan di departemennya', async () => {
      leaveRequestRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerSameDept);
      leaveRequestRepository.findAll = jest
        .fn()
        .mockResolvedValue([mockLeaveRequest]);
      leaveRequestRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await leaveRequestService.findAll(
        { page: 1, limit: 10 },
        managerSameDeptUser,
      );

      expect(result.data).toHaveLength(1);
      expect(leaveRequestRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-eng-uuid',
        }),
      );
    });

    it('16. HR_ADMIN: dapat melihat seluruh permohonan cuti terpaginasi', async () => {
      leaveRequestRepository.findAll = jest
        .fn()
        .mockResolvedValue([mockLeaveRequest]);
      leaveRequestRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await leaveRequestService.findAll(
        { page: 1, limit: 10, status: LeaveRequestStatus.PENDING },
        hrAdminUser,
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(leaveRequestRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          status: LeaveRequestStatus.PENDING,
        }),
      );
    });
  });

  describe('findById()', () => {
    it('17. EMPLOYEE: sukses melihat detail cuti miliknya sendiri', async () => {
      leaveRequestRepository.findById = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);

      const result = await leaveRequestService.findById(
        'lr-uuid-1',
        employeeUser,
      );

      expect(result).toEqual(mockLeaveRequest);
    });

    it('18. EMPLOYEE: ditolak (ForbiddenException) saat melihat cuti orang lain', async () => {
      leaveRequestRepository.findById = jest.fn().mockResolvedValue({
        ...mockLeaveRequest,
        employeeId: 'other-emp-uuid',
      });

      await expect(
        leaveRequestService.findById('lr-uuid-1', employeeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('19. MANAGER: sukses melihat cuti karyawan di departemen yang sama', async () => {
      leaveRequestRepository.findById = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);
      leaveRequestRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerSameDept);

      const result = await leaveRequestService.findById(
        'lr-uuid-1',
        managerSameDeptUser,
      );

      expect(result).toEqual(mockLeaveRequest);
    });

    it('20. MANAGER: ditolak (ForbiddenException) saat melihat cuti karyawan di departemen lain', async () => {
      leaveRequestRepository.findById = jest
        .fn()
        .mockResolvedValue(mockLeaveRequest);
      leaveRequestRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerOtherDept);

      await expect(
        leaveRequestService.findById('lr-uuid-1', managerOtherDeptUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
