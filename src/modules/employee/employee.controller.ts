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
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { EmployeeService } from './employee.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Employees')
@ApiBearerAuth('JWT-auth')
@Controller('employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Roles(UserRole.HR_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tambah karyawan baru dan buat akun login otomatis (HR_ADMIN only)',
    description:
      'Membuat data karyawan baru sekaligus membuat akun login User secara atomik dalam satu transaction. Mengembalikan temporaryPassword plaintext hanya satu kali pada response ini.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Karyawan dan akun login berhasil dibuat. Menyertakan temporaryPassword.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validasi gagal atau departemen tidak ditemukan',
  })
  @ApiResponse({ status: 409, description: 'NIP atau email sudah terdaftar' })
  async create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Daftar karyawan (Role-scoped)',
    description:
      'Mengambil daftar karyawan terpaginasi. HR_ADMIN melihat semua, MANAGER melihat departemennya, EMPLOYEE hanya melihat profilnya sendiri.',
  })
  @ApiResponse({ status: 200, description: 'Daftar karyawan berhasil diambil' })
  async findAll(
    @Query() query: EmployeeQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.employeeService.findAll(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detail karyawan (Role-scoped)',
    description:
      'Mengambil detail profil karyawan. HR_ADMIN melihat siapapun, MANAGER melihat timnya, EMPLOYEE hanya melihat profil sendiri.',
  })
  @ApiParam({ name: 'id', description: 'UUID karyawan' })
  @ApiResponse({ status: 200, description: 'Data karyawan ditemukan' })
  @ApiResponse({
    status: 403,
    description: 'Akses ditolak (di luar scope tim / profil sendiri)',
  })
  @ApiResponse({ status: 404, description: 'Karyawan tidak ditemukan' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.employeeService.findById(id, currentUser);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update data karyawan (HR_ADMIN only)',
    description:
      'Memperbarui data profil karyawan. NIP/email baru harus tetap unik jika diubah.',
  })
  @ApiParam({ name: 'id', description: 'UUID karyawan' })
  @ApiResponse({ status: 200, description: 'Karyawan berhasil diperbarui' })
  @ApiResponse({ status: 400, description: 'Departemen tidak valid' })
  @ApiResponse({ status: 404, description: 'Karyawan tidak ditemukan' })
  @ApiResponse({
    status: 409,
    description: 'NIP atau email baru sudah digunakan',
  })
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(id, updateEmployeeDto);
  }

  @Roles(UserRole.HR_ADMIN)
  @Delete(':id')
  @ApiOperation({
    summary: 'Nonaktifkan / Soft Delete karyawan (HR_ADMIN only)',
    description:
      'Menyetel deletedAt ke waktu sekarang dan status menjadi INACTIVE.',
  })
  @ApiParam({ name: 'id', description: 'UUID karyawan' })
  @ApiResponse({ status: 200, description: 'Karyawan berhasil dinonaktifkan' })
  @ApiResponse({ status: 404, description: 'Karyawan tidak ditemukan' })
  async remove(@Param('id') id: string) {
    return this.employeeService.remove(id);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aktifkan kembali karyawan yang sudah dinonaktifkan (HR_ADMIN only)',
    description:
      'Mengembalikan status karyawan menjadi ACTIVE dan menyetel deletedAt kembali ke null.',
  })
  @ApiParam({ name: 'id', description: 'UUID karyawan' })
  @ApiResponse({
    status: 200,
    description: 'Karyawan berhasil diaktifkan kembali',
  })
  @ApiResponse({ status: 400, description: 'Karyawan sudah aktif' })
  @ApiResponse({ status: 404, description: 'Karyawan tidak ditemukan' })
  @ApiResponse({
    status: 409,
    description: 'NIP atau email bentrok dengan karyawan aktif lain',
  })
  async reactivate(@Param('id') id: string) {
    return this.employeeService.reactivate(id);
  }
}
