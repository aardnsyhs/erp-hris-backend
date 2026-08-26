import {
  Body,
  Controller,
  Delete,
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
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { PayrollQueryDto } from './dto/payroll-query.dto';
import {
  PayrollManagerViewDto,
  PayrollResponseDto,
} from './dto/payroll-response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Payrolls')
@ApiBearerAuth('JWT-auth')
@ApiExtraModels(PayrollResponseDto, PayrollManagerViewDto)
@Controller('payrolls')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Roles(UserRole.HR_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate draft payroll (HR_ADMIN only)',
    description:
      'Membuat record draft payroll baru untuk karyawan. basicSalary di-snapshot dari Employee.baseSalary saat generate dan netSalary dihitung otomatis.',
  })
  @ApiResponse({
    status: 201,
    description: 'Draft payroll berhasil di-generate',
    type: PayrollResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validasi rentang tanggal gagal atau employeeId tidak valid',
  })
  @ApiResponse({
    status: 409,
    description: 'Payroll untuk karyawan pada periode ini sudah ada',
  })
  async create(@Body() createPayrollDto: CreatePayrollDto) {
    return this.payrollService.create(createPayrollDto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Daftar payroll (Role-scoped dengan Field-Stripping untuk Manager)',
    description:
      'Mengambil riwayat payroll terpaginasi. HR_ADMIN & EMPLOYEE (milik sendiri) menerima PayrollResponseDto (finansial lengkap). MANAGER melihat PayrollManagerViewDto (field finansial disembunyikan/di-strip kecuali data miliknya sendiri).',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar payroll berhasil diambil',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            oneOf: [
              { $ref: getSchemaPath(PayrollResponseDto) },
              { $ref: getSchemaPath(PayrollManagerViewDto) },
            ],
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 1 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            totalPages: { type: 'number', example: 1 },
          },
        },
      },
    },
  })
  async findAll(
    @Query() query: PayrollQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.payrollService.findAll(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detail payroll (Role-scoped)',
    description:
      'Mengambil detail payroll. HR_ADMIN & EMPLOYEE (milik sendiri) menerima PayrollResponseDto. MANAGER menerima PayrollManagerViewDto (field finansial disembunyikan jika milik anggota tim). Ditolak jika di luar otorisasi.',
  })
  @ApiParam({ name: 'id', description: 'UUID payroll' })
  @ApiResponse({
    status: 200,
    description: 'Detail payroll ditemukan',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(PayrollResponseDto) },
        { $ref: getSchemaPath(PayrollManagerViewDto) },
      ],
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Akses ditolak (di luar scope tim / profil sendiri)',
  })
  @ApiResponse({ status: 404, description: 'Payroll tidak ditemukan' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.payrollService.findById(id, currentUser);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transisi status DRAFT -> PROCESSED (HR_ADMIN only)',
    description:
      'Mengubah status payroll dari DRAFT menjadi PROCESSED. Ditolak jika status saat ini bukan DRAFT.',
  })
  @ApiParam({ name: 'id', description: 'UUID payroll' })
  @ApiResponse({
    status: 200,
    description: 'Status payroll berhasil diubah ke PROCESSED',
    type: PayrollResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payroll tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Status payroll bukan DRAFT' })
  async process(@Param('id') id: string) {
    return this.payrollService.process(id);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transisi status PROCESSED -> PAID (HR_ADMIN only)',
    description:
      'Mengubah status payroll dari PROCESSED menjadi PAID dan menyetel paymentDate ke tanggal hari ini (UTC date). Ditolak jika status bukan PROCESSED.',
  })
  @ApiParam({ name: 'id', description: 'UUID payroll' })
  @ApiResponse({
    status: 200,
    description: 'Status payroll berhasil diubah ke PAID',
    type: PayrollResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payroll tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Status payroll bukan PROCESSED' })
  async pay(@Param('id') id: string) {
    return this.payrollService.pay(id);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update tunjangan dan potongan saat status DRAFT (HR_ADMIN only)',
    description:
      'Memperbarui nilai allowances dan deductions serta menghitung ulang netSalary. Ditolak dengan ConflictException jika status bukan DRAFT (immutability guard).',
  })
  @ApiParam({ name: 'id', description: 'UUID payroll' })
  @ApiResponse({
    status: 200,
    description: 'Draft payroll berhasil diperbarui',
    type: PayrollResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payroll tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Status payroll bukan DRAFT' })
  async update(
    @Param('id') id: string,
    @Body() updatePayrollDto: UpdatePayrollDto,
  ) {
    return this.payrollService.update(id, updatePayrollDto);
  }

  @Roles(UserRole.HR_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hapus payroll saat status DRAFT (HR_ADMIN only)',
    description:
      'Menghapus record payroll yang masih berstatus DRAFT. Ditolak jika status sudah PROCESSED atau PAID demi menjaga audit trail.',
  })
  @ApiParam({ name: 'id', description: 'UUID payroll' })
  @ApiResponse({ status: 200, description: 'Payroll berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Payroll tidak ditemukan' })
  @ApiResponse({ status: 409, description: 'Status payroll bukan DRAFT' })
  async remove(@Param('id') id: string) {
    return this.payrollService.remove(id);
  }
}
