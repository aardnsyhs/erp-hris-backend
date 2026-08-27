import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { WorkScheduleService } from './work-schedule.service';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Work Schedule')
@ApiBearerAuth('JWT-auth')
@Controller('work-schedule')
export class WorkScheduleController {
  constructor(private readonly workScheduleService: WorkScheduleService) {}

  @Get()
  @ApiOperation({
    summary: 'Ambil konfigurasi jadwal kerja aktif (All authenticated roles)',
    description:
      'Mengambil parameter jam mulai kerja, toleransi keterlambatan, dan target menit kerja harian.',
  })
  @ApiResponse({
    status: 200,
    description: 'Jadwal kerja aktif berhasil diambil',
  })
  async getActiveSchedule() {
    return this.workScheduleService.getActiveSchedule();
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update konfigurasi jadwal kerja (HR_ADMIN only)',
    description:
      'Memperbarui parameter jam mulai kerja, toleransi keterlambatan, dan target menit kerja harian.',
  })
  @ApiResponse({
    status: 200,
    description: 'Jadwal kerja berhasil diperbarui',
  })
  @ApiResponse({
    status: 400,
    description: 'Validasi format atau nilai parameter gagal',
  })
  async updateSchedule(@Body() dto: UpdateWorkScheduleDto) {
    return this.workScheduleService.updateSchedule(dto);
  }
}
