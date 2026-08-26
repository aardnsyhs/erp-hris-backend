import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AttendanceStatus, UserRole } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('AttendanceService', () => {
  let attendanceService: AttendanceService;
  let attendanceRepository: jest.Mocked<Partial<AttendanceRepository>>;

  const mockEmployee = {
    id: 'emp-uuid-1',
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
  };

  const managerEmployee = {
    ...mockEmployee,
    id: 'emp-manager-uuid',
    departmentId: 'dept-eng-uuid',
    nip: 'EMP002',
    email: 'manager@example.com',
    jobTitle: 'Engineering Manager',
  };

  const employeeUser: AuthenticatedUser = {
    userId: 'user-emp-uuid',
    email: 'john@example.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-uuid-1',
  };

  const managerUser: AuthenticatedUser = {
    userId: 'user-manager-uuid',
    email: 'manager@example.com',
    role: UserRole.MANAGER,
    employeeId: 'emp-manager-uuid',
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin-uuid',
    email: 'admin@example.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin-uuid',
  };

  const mockAttendance = {
    id: 'att-uuid-1',
    employeeId: 'emp-uuid-1',
    attendanceDate: new Date(),
    checkIn: new Date(Date.now() - 3600000), // 1 hour ago
    checkOut: null,
    status: AttendanceStatus.PRESENT,
    notes: 'On time',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    attendanceRepository = {
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      findByEmployeeAndDate: jest.fn(),
      findAll: jest.fn(),
      countAll: jest.fn(),
      findEmployeeById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: AttendanceRepository, useValue: attendanceRepository },
      ],
    }).compile();

    attendanceService = module.get<AttendanceService>(AttendanceService);
  });

  describe('checkIn()', () => {
    const checkInDto: CheckInDto = {
      notes: 'Working from office',
    };

    it('1. Sukses check-in: status default PRESENT dan checkIn tersimpan', async () => {
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(null);
      attendanceRepository.checkIn = jest.fn().mockResolvedValue({
        ...mockAttendance,
        notes: 'Working from office',
      });

      const result = await attendanceService.checkIn(employeeUser, checkInDto);

      expect(result).toBeDefined();
      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(attendanceRepository.findByEmployeeAndDate).toHaveBeenCalled();
      expect(attendanceRepository.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-uuid-1',
          status: AttendanceStatus.PRESENT,
          notes: 'Working from office',
        }),
      );
    });

    it('2. Gagal check-in: user tanpa employeeId melempar ForbiddenException', async () => {
      const userWithoutEmp: AuthenticatedUser = {
        ...employeeUser,
        employeeId: null,
      };

      await expect(
        attendanceService.checkIn(userWithoutEmp, checkInDto),
      ).rejects.toThrow(ForbiddenException);
      expect(attendanceRepository.checkIn).not.toHaveBeenCalled();
    });

    it('3. Gagal check-in: sudah pernah check-in hari ini melempar ConflictException', async () => {
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(mockAttendance);

      await expect(
        attendanceService.checkIn(employeeUser, checkInDto),
      ).rejects.toThrow(ConflictException);
      expect(attendanceRepository.checkIn).not.toHaveBeenCalled();
    });
  });

  describe('checkOut()', () => {
    const checkOutDto: CheckOutDto = {
      notes: 'Done for the day',
    };

    it('4. Sukses check-out: memperbarui checkOut time', async () => {
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(mockAttendance);
      attendanceRepository.checkOut = jest.fn().mockResolvedValue({
        ...mockAttendance,
        checkOut: new Date(),
        notes: 'Done for the day',
      });

      const result = await attendanceService.checkOut(
        employeeUser,
        checkOutDto,
      );

      expect(result).toBeDefined();
      expect(attendanceRepository.checkOut).toHaveBeenCalledWith(
        'att-uuid-1',
        expect.any(Date),
        'Done for the day',
      );
    });

    it('5. Gagal check-out: user tanpa employeeId melempar ForbiddenException', async () => {
      const userWithoutEmp: AuthenticatedUser = {
        ...employeeUser,
        employeeId: null,
      };

      await expect(
        attendanceService.checkOut(userWithoutEmp, checkOutDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('6. Gagal check-out: belum check-in hari ini melempar BadRequestException', async () => {
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(null);

      await expect(
        attendanceService.checkOut(employeeUser, checkOutDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. Gagal check-out: sudah check-out hari ini melempar ConflictException', async () => {
      const alreadyCheckedOut = {
        ...mockAttendance,
        checkOut: new Date(),
      };
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(alreadyCheckedOut);

      await expect(
        attendanceService.checkOut(employeeUser, checkOutDto),
      ).rejects.toThrow(ConflictException);
    });

    it('8. Gagal check-out: checkOut lebih awal dari checkIn melempar BadRequestException', async () => {
      const futureCheckIn = {
        ...mockAttendance,
        checkIn: new Date(Date.now() + 3600000), // check-in is 1 hour in future
      };
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(futureCheckIn);

      await expect(
        attendanceService.checkOut(employeeUser, checkOutDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll()', () => {
    it('9. EMPLOYEE: dibatasi hanya melihat riwayat absensi miliknya sendiri', async () => {
      attendanceRepository.findAll = jest
        .fn()
        .mockResolvedValue([mockAttendance]);
      attendanceRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await attendanceService.findAll(
        { page: 1, limit: 10 },
        employeeUser,
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(attendanceRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-uuid-1',
        }),
      );
    });

    it('10. EMPLOYEE tanpa employeeId: mengembalikan list kosong', async () => {
      const userWithoutEmp: AuthenticatedUser = {
        ...employeeUser,
        employeeId: null,
      };

      const result = await attendanceService.findAll(
        { page: 1, limit: 10 },
        userWithoutEmp,
      );

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('11. MANAGER: dibatasi hanya melihat absensi karyawan di departemennya', async () => {
      attendanceRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerEmployee);
      attendanceRepository.findAll = jest
        .fn()
        .mockResolvedValue([mockAttendance]);
      attendanceRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await attendanceService.findAll(
        { page: 1, limit: 10 },
        managerUser,
      );

      expect(result.data).toHaveLength(1);
      expect(attendanceRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'dept-eng-uuid',
        }),
      );
    });

    it('12. MANAGER tanpa employeeId: mengembalikan list kosong', async () => {
      const managerWithoutEmp: AuthenticatedUser = {
        ...managerUser,
        employeeId: null,
      };

      const result = await attendanceService.findAll(
        { page: 1, limit: 10 },
        managerWithoutEmp,
      );

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('13. HR_ADMIN: dapat melihat seluruh riwayat absensi terpaginasi', async () => {
      attendanceRepository.findAll = jest
        .fn()
        .mockResolvedValue([mockAttendance]);
      attendanceRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await attendanceService.findAll(
        { page: 1, limit: 10, employeeId: 'emp-uuid-1' },
        hrAdminUser,
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(attendanceRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-uuid-1',
          departmentId: undefined,
        }),
      );
    });

    it('14. Keamanan Finansial: Relasi employee pada response absensi TIDAK memiliki baseSalary', async () => {
      const attendanceWithNonFinancialEmployee = {
        ...mockAttendance,
        employee: {
          id: 'emp-uuid-1',
          nip: 'EMP001',
          fullName: 'John Doe',
          email: 'john@example.com',
          jobTitle: 'Software Engineer',
          departmentId: 'dept-eng-uuid',
        },
      };

      attendanceRepository.findEmployeeById = jest
        .fn()
        .mockResolvedValue(managerEmployee);
      attendanceRepository.findAll = jest
        .fn()
        .mockResolvedValue([attendanceWithNonFinancialEmployee]);
      attendanceRepository.countAll = jest.fn().mockResolvedValue(1);

      const result = await attendanceService.findAll(
        { page: 1, limit: 10 },
        managerUser,
      );

      expect(result.data).toHaveLength(1);
      const returnedEmployee = (result.data[0] as any).employee;
      expect(returnedEmployee).toBeDefined();
      expect(returnedEmployee.baseSalary).toBeUndefined();
    });
  });
});
