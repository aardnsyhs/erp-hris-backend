import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuditLogService } from './audit-log.service';
import { FindAuditLogsQueryDto } from './dto/audit-log.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Audit Logs')
@ApiBearerAuth('JWT-auth')
@UseGuards(RolesGuard)
@Roles(UserRole.HR_ADMIN)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar audit logs (HR_ADMIN only)',
    description:
      'Mengambil daftar log audit terpaginasi dengan filter entity, action, actorId, dan rentang tanggal.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar audit log berhasil diambil',
  })
  @ApiResponse({
    status: 403,
    description: 'Akses ditolak: Hanya HR_ADMIN yang dapat melihat audit logs',
  })
  async findAll(@Query() query: FindAuditLogsQueryDto) {
    return this.auditLogService.findMany(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detail audit log berdasarkan ID (HR_ADMIN only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Detail audit log berhasil diambil',
  })
  @ApiResponse({
    status: 404,
    description: 'Audit log tidak ditemukan',
  })
  async findById(@Param('id') id: string) {
    const log = await this.auditLogService.findById(id);
    if (!log) {
      throw new NotFoundException(`Audit log dengan ID '${id}' tidak ditemukan`);
    }
    return log;
  }
}
