import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { LeaveRequestService } from './leave-request.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { LeaveRequestQueryDto } from './dto/leave-request-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Leave Requests')
@ApiBearerAuth('JWT-auth')
@Controller('leave-requests')
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ajukan permohonan cuti baru (Authenticated User with employeeId)',
    description:
      'Membuat pengajuan cuti baru dengan status PENDING. Ditolak jika tanggal selesai < mulai atau terdapat overlap dengan cuti APPROVED.',
  })
  @ApiResponse({ status: 201, description: 'Permohonan cuti berhasil dibuat' })
  @ApiResponse({
    status: 400,
    description: 'Tanggal tidak valid (endDate < startDate)',
  })
  @ApiResponse({
    status: 403,
    description: 'Akun tidak terhubung dengan data karyawan',
  })
  @ApiResponse({
    status: 409,
    description: 'Terdapat overlap dengan cuti yang sudah APPROVED',
  })
  async create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() createLeaveRequestDto: CreateLeaveRequestDto,
  ) {
    return this.leaveRequestService.create(currentUser, createLeaveRequestDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Daftar permohonan cuti (Role-scoped)',
    description:
      'Mengambil daftar cuti terpaginasi. HR_ADMIN melihat semua, MANAGER melihat departemennya, EMPLOYEE melihat miliknya sendiri.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar permohonan cuti berhasil diambil',
  })
  async findAll(
    @Query() query: LeaveRequestQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.leaveRequestService.findAll(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detail permohonan cuti (Role-scoped)',
    description:
      'Mengambil detail permohonan cuti. Ditolak jika di luar otorisasi departemen / profil sendiri.',
  })
  @ApiParam({ name: 'id', description: 'UUID permohonan cuti' })
  @ApiResponse({ status: 200, description: 'Detail cuti ditemukan' })
  @ApiResponse({
    status: 403,
    description: 'Akses ditolak (di luar scope tim / profil sendiri)',
  })
  @ApiResponse({ status: 404, description: 'Permohonan cuti tidak ditemukan' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.leaveRequestService.findById(id, currentUser);
  }

  @Roles(UserRole.HR_ADMIN, UserRole.MANAGER)
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Setujui permohonan cuti (HR_ADMIN / Same-department MANAGER)',
    description:
      'Menyetujui cuti berstatus PENDING. Ditolak jika permohonan milik sendiri, status bukan PENDING, atau beda departemen.',
  })
  @ApiParam({ name: 'id', description: 'UUID permohonan cuti' })
  @ApiResponse({
    status: 200,
    description: 'Permohonan cuti berhasil disetujui (APPROVED)',
  })
  @ApiResponse({
    status: 403,
    description: 'Self-approval dicegah atau beda departemen',
  })
  @ApiResponse({ status: 404, description: 'Permohonan cuti tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Status cuti bukan PENDING' })
  async approve(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.leaveRequestService.approve(id, currentUser);
  }

  @Roles(UserRole.HR_ADMIN, UserRole.MANAGER)
  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tolak permohonan cuti (HR_ADMIN / Same-department MANAGER)',
    description:
      'Menolak cuti berstatus PENDING dengan menyertakan alasan penolakan (rejectionReason).',
  })
  @ApiParam({ name: 'id', description: 'UUID permohonan cuti' })
  @ApiResponse({
    status: 200,
    description: 'Permohonan cuti berhasil ditolak (REJECTED)',
  })
  @ApiResponse({ status: 400, description: 'Alasan penolakan tidak diisi' })
  @ApiResponse({
    status: 403,
    description: 'Self-rejection dicegah atau beda departemen',
  })
  @ApiResponse({ status: 404, description: 'Permohonan cuti tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Status cuti bukan PENDING' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() rejectLeaveRequestDto: RejectLeaveRequestDto,
  ) {
    return this.leaveRequestService.reject(
      id,
      currentUser,
      rejectLeaveRequestDto,
    );
  }
}
