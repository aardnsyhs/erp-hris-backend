import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AttendanceStatus, UserRole } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { WorkScheduleRepository } from '../work-schedule/work-schedule.repository';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { DEFAULT_WORK_SCHEDULE } from '../work-schedule/work-schedule.constants';

describe('AttendanceService', () => {
  let attendanceService: AttendanceService;
  let attendanceRepository: jest.Mocked<Partial<AttendanceRepository>>;
  let workScheduleRepository: jest.Mocked<Partial<WorkScheduleRepository>>;

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

    workScheduleRepository = {
      findActive: jest.fn().mockResolvedValue(DEFAULT_WORK_SCHEDULE as any),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: AttendanceRepository, useValue: attendanceRepository },
        { provide: WorkScheduleRepository, useValue: workScheduleRepository },
      ],
    }).compile();

    attendanceService = module.get<AttendanceService>(AttendanceService);
  });

  describe('checkIn()', () => {
    const checkInDto: CheckInDto = {
      notes: 'Working from office',
    };

    it('1. Sukses check-in: status otomatis diklasifikasikan dan snapshot tersimpan', async () => {
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(null);
      attendanceRepository.checkIn = jest.fn().mockImplementation((data) => ({
        ...mockAttendance,
        ...data,
      }));

      const result = await attendanceService.checkIn(employeeUser, checkInDto);

      expect(result).toBeDefined();
      expect(attendanceRepository.findByEmployeeAndDate).toHaveBeenCalled();
      expect(workScheduleRepository.findActive).toHaveBeenCalled();
      expect(attendanceRepository.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-uuid-1',
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

    it('3. Gagal check-in: sudah check-in hari ini melempar ConflictException', async () => {
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(mockAttendance);

      await expect(
        attendanceService.checkIn(employeeUser, checkInDto),
      ).rejects.toThrow(ConflictException);
      expect(attendanceRepository.checkIn).not.toHaveBeenCalled();
    });

    it('4. FR-3.3 Timezone Independence: Check-in jam 09:10 WIB (02:10 UTC) diklasifikasikan PRESENT', async () => {
      // Mock Date to 02:10:00 UTC = 09:10:00 WIB (before 09:15 cutoff)
      const fakeDate = new Date('2026-08-27T02:10:00.000Z');
      jest.useFakeTimers({ now: fakeDate });

      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(null);
      attendanceRepository.checkIn = jest.fn().mockImplementation((data) => ({
        ...mockAttendance,
        ...data,
      }));

      const result = await attendanceService.checkIn(employeeUser, checkInDto);

      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(attendanceRepository.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AttendanceStatus.PRESENT,
        }),
      );

      jest.useRealTimers();
    });

    it('5. FR-3.3 Timezone Independence: Check-in jam 09:20 WIB (02:20 UTC) melewati batas toleransi diklasifikasikan LATE', async () => {
      // Mock Date to 02:20:00 UTC = 09:20:00 WIB (after 09:15 cutoff)
      const fakeDate = new Date('2026-08-27T02:20:00.000Z');
      jest.useFakeTimers({ now: fakeDate });

      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(null);
      attendanceRepository.checkIn = jest.fn().mockImplementation((data) => ({
        ...mockAttendance,
        ...data,
      }));

      const result = await attendanceService.checkIn(employeeUser, checkInDto);

      expect(result.status).toBe(AttendanceStatus.LATE);
      expect(attendanceRepository.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          status: AttendanceStatus.LATE,
        }),
      );

      jest.useRealTimers();
    });
  });

  describe('checkOut()', () => {
    const checkOutDto: CheckOutDto = {
      notes: 'Work completed',
    };

    it('6. Sukses check-out: waktu checkOut dan notes diperbarui', async () => {
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(mockAttendance);
      attendanceRepository.checkOut = jest.fn().mockResolvedValue({
        ...mockAttendance,
        checkOut: new Date(),
        notes: 'Work completed',
      });

      const result = await attendanceService.checkOut(
        employeeUser,
        checkOutDto,
      );

      expect(result).toBeDefined();
      expect(result.checkOut).toBeDefined();
      expect(attendanceRepository.checkOut).toHaveBeenCalledWith(
        'att-uuid-1',
        expect.any(Date),
        'Work completed',
      );
    });

    it('7. Gagal check-out: belum check-in hari ini melempar BadRequestException', async () => {
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(null);

      await expect(
        attendanceService.checkOut(employeeUser, checkOutDto),
      ).rejects.toThrow(BadRequestException);
      expect(attendanceRepository.checkOut).not.toHaveBeenCalled();
    });

    it('8. Gagal check-out: sudah pernah check-out hari ini melempar ConflictException', async () => {
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

    it('9. Gagal check-out: checkOut lebih awal dari checkIn melempar BadRequestException', async () => {
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
    it('10. EMPLOYEE: dibatasi hanya melihat riwayat absensi miliknya sendiri', async () => {
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

    it('11. EMPLOYEE tanpa employeeId: mengembalikan list kosong', async () => {
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

    it('12. MANAGER: dibatasi hanya melihat absensi karyawan di departemennya', async () => {
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

    it('13. MANAGER tanpa employeeId: mengembalikan list kosong', async () => {
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

    it('14. HR_ADMIN: dapat melihat seluruh riwayat absensi terpaginasi', async () => {
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

    it('15. Keamanan Finansial: Relasi employee pada response absensi TIDAK memiliki baseSalary', async () => {
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

  describe('getTodayAttendance()', () => {
    it('16. Sukses: mengembalikan data absensi hari ini milik user login spesifik', async () => {
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(mockAttendance);

      const result = await attendanceService.getTodayAttendance(employeeUser);

      expect(result).toEqual(mockAttendance);
      expect(attendanceRepository.findByEmployeeAndDate).toHaveBeenCalledWith(
        'emp-uuid-1',
        expect.any(Date),
      );
    });

    it('17. Sukses: mengembalikan null jika user login belum absen hari ini (tidak mengambil record karyawan lain)', async () => {
      attendanceRepository.findByEmployeeAndDate = jest
        .fn()
        .mockResolvedValue(null);

      const hrAdminUser = {
        userId: 'hr-user-uuid',
        email: 'admin.hr@example.com',
        role: UserRole.HR_ADMIN,
        employeeId: 'hr-emp-uuid',
      };

      const result = await attendanceService.getTodayAttendance(hrAdminUser);

      expect(result).toBeNull();
      expect(attendanceRepository.findByEmployeeAndDate).toHaveBeenCalledWith(
        'hr-emp-uuid',
        expect.any(Date),
      );
    });

    it('18. Sukses: mengembalikan null jika user tidak terhubung dengan employeeId', async () => {
      const userWithoutEmp = {
        userId: 'no-emp-user',
        email: 'orphan@example.com',
        role: UserRole.EMPLOYEE,
        employeeId: null,
      };

      const result = await attendanceService.getTodayAttendance(userWithoutEmp);

      expect(result).toBeNull();
      expect(attendanceRepository.findByEmployeeAndDate).not.toHaveBeenCalled();
    });
  });

  describe('P0-A: Timezone & Asia/Jakarta Calendar Consistency', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('early check-in at 06:30 WIB (23:30 UTC previous day) correctly maps to local Asia/Jakarta date', async () => {
      // 06:30:00 WIB on 2026-09-04 = 23:30:00 UTC on 2026-09-03
      const checkInTime = new Date('2026-09-03T23:30:00.000Z');
      jest.useFakeTimers({ now: checkInTime });

      attendanceRepository.findByEmployeeAndDate = jest.fn().mockResolvedValue(null);
      attendanceRepository.checkIn = jest.fn().mockImplementation((data) => ({
        ...mockAttendance,
        ...data,
      }));

      const result = await attendanceService.checkIn(employeeUser, { notes: 'Early bird' });

      // Expected normalized date for 2026-09-04 in Asia/Jakarta: 2026-09-04T00:00:00.000Z
      const expectedAttendanceDate = new Date('2026-09-04T00:00:00.000Z');

      expect(attendanceRepository.findByEmployeeAndDate).toHaveBeenCalledWith(
        'emp-uuid-1',
        expectedAttendanceDate,
      );
      expect(attendanceRepository.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          employeeId: 'emp-uuid-1',
          attendanceDate: expectedAttendanceDate,
          checkIn: checkInTime,
          status: AttendanceStatus.PRESENT,
        }),
      );
    });

    it('check-in at 06:30 WIB and check-out at 17:00 WIB on the same local date use identical attendanceDate', async () => {
      const checkInTime = new Date('2026-09-03T23:30:00.000Z'); // 06:30 WIB on 2026-09-04
      const checkOutTime = new Date('2026-09-04T10:00:00.000Z'); // 17:00 WIB on 2026-09-04
      const expectedAttendanceDate = new Date('2026-09-04T00:00:00.000Z');

      // 1. Employee checks in early at 06:30 WIB
      jest.useFakeTimers({ now: checkInTime });
      attendanceRepository.findByEmployeeAndDate = jest.fn().mockResolvedValue(null);
      const earlyRecord = {
        id: 'att-early-uuid',
        employeeId: 'emp-uuid-1',
        attendanceDate: expectedAttendanceDate,
        checkIn: checkInTime,
        checkOut: null,
        status: AttendanceStatus.PRESENT,
        notes: 'Early check-in',
        createdAt: checkInTime,
        updatedAt: checkInTime,
      };
      attendanceRepository.checkIn = jest.fn().mockResolvedValue(earlyRecord);

      await attendanceService.checkIn(employeeUser, { notes: 'Early check-in' });

      expect(attendanceRepository.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          attendanceDate: expectedAttendanceDate,
        }),
      );

      // 2. Employee checks out at 17:00 WIB
      jest.useFakeTimers({ now: checkOutTime });
      attendanceRepository.findByEmployeeAndDate = jest.fn().mockImplementation((empId, date) => {
        if (date.getTime() === expectedAttendanceDate.getTime()) {
          return Promise.resolve(earlyRecord);
        }
        return Promise.resolve(null);
      });
      attendanceRepository.checkOut = jest.fn().mockImplementation((id, time, notes) => ({
        ...earlyRecord,
        checkOut: time,
        notes,
      }));

      const checkOutResult = await attendanceService.checkOut(employeeUser, { notes: 'Done for the day' });

      expect(attendanceRepository.findByEmployeeAndDate).toHaveBeenCalledWith(
        'emp-uuid-1',
        expectedAttendanceDate,
      );
      expect(checkOutResult.checkOut).toEqual(checkOutTime);
    });

    it('regression: check-in at 09:10 WIB (02:10 UTC) and check-out at 17:30 WIB (10:30 UTC) function normally on same date', async () => {
      const checkInTime = new Date('2026-09-04T02:10:00.000Z'); // 09:10 WIB
      const checkOutTime = new Date('2026-09-04T10:30:00.000Z'); // 17:30 WIB
      const expectedAttendanceDate = new Date('2026-09-04T00:00:00.000Z');

      // Check-in
      jest.useFakeTimers({ now: checkInTime });
      attendanceRepository.findByEmployeeAndDate = jest.fn().mockResolvedValue(null);
      attendanceRepository.checkIn = jest.fn().mockImplementation((data) => ({
        id: 'att-normal-uuid',
        ...data,
      }));

      await attendanceService.checkIn(employeeUser, {});

      expect(attendanceRepository.checkIn).toHaveBeenCalledWith(
        expect.objectContaining({
          attendanceDate: expectedAttendanceDate,
          status: AttendanceStatus.PRESENT,
        }),
      );

      // Check-out
      jest.useFakeTimers({ now: checkOutTime });
      attendanceRepository.findByEmployeeAndDate = jest.fn().mockResolvedValue({
        id: 'att-normal-uuid',
        employeeId: 'emp-uuid-1',
        attendanceDate: expectedAttendanceDate,
        checkIn: checkInTime,
        checkOut: null,
      });
      attendanceRepository.checkOut = jest.fn().mockImplementation((id, time) => ({
        id,
        checkOut: time,
      }));

      const checkOutRes = await attendanceService.checkOut(employeeUser, {});
      expect(checkOutRes.checkOut).toEqual(checkOutTime);
    });

    it('getTodayAttendance returns today record for early morning user (before 07:00 WIB)', async () => {
      const earlyMorning = new Date('2026-09-03T23:45:00.000Z'); // 06:45 WIB Sep 4
      jest.useFakeTimers({ now: earlyMorning });

      const expectedAttendanceDate = new Date('2026-09-04T00:00:00.000Z');
      attendanceRepository.findByEmployeeAndDate = jest.fn().mockResolvedValue(mockAttendance);

      await attendanceService.getTodayAttendance(employeeUser);

      expect(attendanceRepository.findByEmployeeAndDate).toHaveBeenCalledWith(
        'emp-uuid-1',
        expectedAttendanceDate,
      );
    });
  });
});
