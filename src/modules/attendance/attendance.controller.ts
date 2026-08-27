import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Attendances')
@ApiBearerAuth('JWT-auth')
@Controller('attendances')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Check-in absensi harian (Authenticated User with employeeId)',
    description:
      'Melakukan check-in hari ini untuk user yang sedang login. Ditolak jika sudah pernah check-in hari ini.',
  })
  @ApiResponse({ status: 201, description: 'Check-in berhasil tercatat' })
  @ApiResponse({
    status: 403,
    description: 'Akun tidak terhubung dengan data karyawan',
  })
  @ApiResponse({
    status: 409,
    description: 'Sudah melakukan check-in hari ini',
  })
  async checkIn(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() checkInDto: CheckInDto,
  ) {
    return this.attendanceService.checkIn(currentUser, checkInDto);
  }

  @Patch('check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check-out absensi harian (Authenticated User with employeeId)',
    description:
      'Melakukan check-out untuk absensi hari ini. Ditolak jika belum check-in atau sudah pernah check-out.',
  })
  @ApiResponse({ status: 200, description: 'Check-out berhasil tercatat' })
  @ApiResponse({
    status: 400,
    description: 'Belum check-in hari ini atau waktu tidak valid',
  })
  @ApiResponse({
    status: 403,
    description: 'Akun tidak terhubung dengan data karyawan',
  })
  @ApiResponse({
    status: 409,
    description: 'Sudah melakukan check-out hari ini',
  })
  async checkOut(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() checkOutDto: CheckOutDto,
  ) {
    return this.attendanceService.checkOut(currentUser, checkOutDto);
  }

  @Get('me/today')
  @ApiOperation({
    summary: 'Status absensi hari ini milik pengguna yang sedang login',
    description:
      'Mengembalikan data absensi hari ini milik user login, atau null jika belum absen.',
  })
  @ApiResponse({
    status: 200,
    description: 'Status absensi hari ini berhasil diambil',
  })
  async getTodayAttendance(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.attendanceService.getTodayAttendance(currentUser);
  }

  @Get()
  @ApiOperation({
    summary: 'Daftar riwayat absensi (Role-scoped)',
    description:
      'Mengambil riwayat absensi. HR_ADMIN melihat semua, MANAGER melihat departemennya, EMPLOYEE melihat miliknya sendiri.',
  })
  @ApiResponse({ status: 200, description: 'Daftar absensi berhasil diambil' })
  async findAll(
    @Query() query: AttendanceQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.attendanceService.findAll(query, currentUser);
  }
}
