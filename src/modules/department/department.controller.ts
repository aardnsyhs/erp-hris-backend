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
import { UserRole } from '@prisma/client';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Roles(UserRole.HR_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentService.create(createDepartmentDto);
  }

  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    return this.departmentService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.departmentService.findById(id);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentService.update(id, updateDepartmentDto);
  }

  @Roles(UserRole.HR_ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.departmentService.remove(id);
  }
}
