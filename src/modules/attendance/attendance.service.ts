import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AttendanceStatus, UserRole } from '@prisma/client';
import { AttendanceRepository } from './attendance.repository';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class AttendanceService {
  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  private getTodayUtcDate(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  async checkIn(currentUser: AuthenticatedUser, checkInDto: CheckInDto) {
    if (!currentUser.employeeId) {
      throw new ForbiddenException(
        'Akun Anda tidak terhubung dengan data karyawan',
      );
    }

    const todayUtc = this.getTodayUtcDate();

    // 1. Validasi unique constraint (employeeId, attendanceDate)
    const existingAttendance =
      await this.attendanceRepository.findByEmployeeAndDate(
        currentUser.employeeId,
        todayUtc,
      );

    if (existingAttendance) {
      throw new ConflictException('Anda sudah melakukan check-in hari ini');
    }

    const nowUtc = new Date();

    // TODO: Cutoff time / late threshold logic to be implemented once organization business hours are agreed upon
    const defaultStatus = AttendanceStatus.PRESENT;

    return this.attendanceRepository.checkIn({
      employeeId: currentUser.employeeId,
      attendanceDate: todayUtc,
      checkIn: nowUtc,
      status: defaultStatus,
      notes: checkInDto.notes,
    });
  }

  async checkOut(currentUser: AuthenticatedUser, checkOutDto: CheckOutDto) {
    if (!currentUser.employeeId) {
      throw new ForbiddenException(
        'Akun Anda tidak terhubung dengan data karyawan',
      );
    }

    const todayUtc = this.getTodayUtcDate();

    const attendance = await this.attendanceRepository.findByEmployeeAndDate(
      currentUser.employeeId,
      todayUtc,
    );

    // 1. Belum check-in
    if (!attendance || !attendance.checkIn) {
      throw new BadRequestException('Anda belum melakukan check-in hari ini');
    }

    // 2. Sudah pernah check-out
    if (attendance.checkOut) {
      throw new ConflictException('Anda sudah melakukan check-out hari ini');
    }

    const nowUtc = new Date();

    // 3. Waktu check-out strictly earlier than check-in
    if (nowUtc < attendance.checkIn) {
      throw new BadRequestException(
        'Waktu check-out tidak boleh lebih awal dari waktu check-in',
      );
    }

    return this.attendanceRepository.checkOut(
      attendance.id,
      nowUtc,
      checkOutDto.notes,
    );
  }

  async findAll(query: AttendanceQueryDto, currentUser: AuthenticatedUser) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    let targetEmployeeId = query.employeeId;
    let targetDepartmentId = query.departmentId;

    // 1. Role: EMPLOYEE -> Hanya dapat melihat riwayat miliknya sendiri
    if (currentUser.role === UserRole.EMPLOYEE) {
      if (!currentUser.employeeId) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }
      targetEmployeeId = currentUser.employeeId;
      targetDepartmentId = undefined;
    }

    // 2. Role: MANAGER -> Hanya dapat melihat absensi tim (departemen yang sama)
    if (currentUser.role === UserRole.MANAGER) {
      if (!currentUser.employeeId) {
        // Edge case: Akun Manager belum dihubungkan ke record Employee
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      const managerEmployee = await this.attendanceRepository.findEmployeeById(
        currentUser.employeeId,
      );
      if (!managerEmployee) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }

      targetDepartmentId = managerEmployee.departmentId;
    }

    // 3. Eksekusi query dengan filter yang telah divalidasi per role
    const [data, total] = await Promise.all([
      this.attendanceRepository.findAll({
        skip,
        take: limit,
        employeeId: targetEmployeeId,
        departmentId: targetDepartmentId,
        status: query.status,
        startDate: query.startDate,
        endDate: query.endDate,
      }),
      this.attendanceRepository.countAll({
        employeeId: targetEmployeeId,
        departmentId: targetDepartmentId,
        status: query.status,
        startDate: query.startDate,
        endDate: query.endDate,
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }
}
