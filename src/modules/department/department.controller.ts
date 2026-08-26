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
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';

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
    description: 'Mengambil daftar departemen dengan paginasi dan pencarian.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar departemen berhasil diambil',
  })
  async findAll(@Query() query: PaginationQueryDto) {
    return this.departmentService.findAll(query);
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
  @Delete(':id')
  @ApiOperation({
    summary: 'Hapus departemen (HR_ADMIN only)',
    description:
      'Menghapus departemen secara permanen. Ditolak jika masih terdapat karyawan aktif di dalamnya.',
  })
  @ApiParam({ name: 'id', description: 'UUID departemen' })
  @ApiResponse({ status: 200, description: 'Departemen berhasil dihapus' })
  @ApiResponse({
    status: 400,
    description: 'Terdapat karyawan aktif di departemen ini',
  })
  @ApiResponse({ status: 404, description: 'Departemen tidak ditemukan' })
  async remove(@Param('id') id: string) {
    return this.departmentService.remove(id);
  }
}
