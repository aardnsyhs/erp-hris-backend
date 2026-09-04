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
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentQueryDto } from './dto/department-query.dto';
import { DepartmentTreeQueryDto } from './dto/department-tree-query.dto';
import { ArchiveDepartmentDto } from './dto/archive-department.dto';
import { RestoreDepartmentDto } from './dto/restore-department.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Departments')
@ApiBearerAuth('JWT-auth')
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Roles(UserRole.HR_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tambah departemen baru (HR_ADMIN only)',
    description: 'Membuat departemen baru. Kode departemen harus unik.',
  })
  @ApiResponse({ status: 201, description: 'Departemen berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Validasi input gagal' })
  @ApiResponse({ status: 409, description: 'Kode departemen sudah digunakan' })
  async create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentService.create(createDepartmentDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Daftar departemen terpaginasi (All authenticated roles)',
    description:
      'Mengambil daftar departemen dengan paginasi, pencarian, dan filter status (ACTIVE, ARCHIVED, ALL). Default: ACTIVE.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar departemen berhasil diambil',
  })
  async findAll(@Query() query: DepartmentQueryDto) {
    return this.departmentService.findAll(query);
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Struktur pohon hierarki departemen (All authenticated roles)',
    description:
      'Mengambil seluruh struktur hierarki departemen dalam format nested tree (O(n) single pass). Default: hanya departemen aktif. Gunakan ?includeArchived=true untuk memuat seluruh pohon (aktif & arsip).',
  })
  @ApiResponse({
    status: 200,
    description: 'Pohon hierarki departemen berhasil diambil',
  })
  async getTree(@Query() query: DepartmentTreeQueryDto) {
    return this.departmentService.getTree(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detail departemen berdasarkan ID (All authenticated roles)',
    description: 'Mengambil detail data satu departemen.',
  })
  @ApiParam({ name: 'id', description: 'UUID departemen' })
  @ApiResponse({ status: 200, description: 'Detail departemen ditemukan' })
  @ApiResponse({ status: 404, description: 'Departemen tidak ditemukan' })
  async findOne(@Param('id') id: string) {
    return this.departmentService.findById(id);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update data departemen (HR_ADMIN only)',
    description:
      'Memperbarui nama atau kode departemen. Kode baru harus tetap unik.',
  })
  @ApiParam({ name: 'id', description: 'UUID departemen' })
  @ApiResponse({ status: 200, description: 'Departemen berhasil diperbarui' })
  @ApiResponse({ status: 404, description: 'Departemen tidak ditemukan' })
  @ApiResponse({
    status: 409,
    description: 'Kode departemen baru sudah digunakan',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentService.update(id, updateDepartmentDto);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Arsipkan departemen (HR_ADMIN only)',
    description:
      'Menonaktifkan departemen. Ditolak jika masih memiliki karyawan aktif.',
  })
  @ApiParam({ name: 'id', description: 'UUID departemen' })
  @ApiResponse({ status: 200, description: 'Departemen berhasil diarsipkan' })
  @ApiResponse({
    status: 400,
    description:
      'Departemen sudah diarsipkan atau masih memiliki karyawan aktif',
  })
  @ApiResponse({ status: 404, description: 'Departemen tidak ditemukan' })
  async archive(
    @Param('id') id: string,
    @Body() archiveDepartmentDto: ArchiveDepartmentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.departmentService.archive(id, archiveDepartmentDto, currentUser);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aktifkan kembali departemen (HR_ADMIN only)',
    description: 'Mengaktifkan kembali departemen yang telah diarsipkan.',
  })
  @ApiParam({ name: 'id', description: 'UUID departemen' })
  @ApiResponse({
    status: 200,
    description: 'Departemen berhasil diaktifkan kembali',
  })
  @ApiResponse({
    status: 400,
    description: 'Departemen sudah dalam status aktif',
  })
  @ApiResponse({ status: 404, description: 'Departemen tidak ditemukan' })
  async restore(
    @Param('id') id: string,
    @Body() restoreDepartmentDto: RestoreDepartmentDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.departmentService.restore(id, restoreDepartmentDto, currentUser);
  }

  @Roles(UserRole.HR_ADMIN)
  @Delete(':id')
  @ApiOperation({
    summary: 'Hapus departemen (HR_ADMIN only)',
    description:
      'Menghapus departemen secara permanen. Ditolak jika memiliki riwayat karyawan atau penugasan posisi.',
  })
  @ApiParam({ name: 'id', description: 'UUID departemen' })
  @ApiResponse({ status: 200, description: 'Departemen berhasil dihapus' })
  @ApiResponse({
    status: 400,
    description:
      'Terdapat data karyawan atau penugasan posisi terkait dengan departemen ini',
  })
  @ApiResponse({ status: 404, description: 'Departemen tidak ditemukan' })
  async remove(@Param('id') id: string) {
    return this.departmentService.remove(id);
  }
}
