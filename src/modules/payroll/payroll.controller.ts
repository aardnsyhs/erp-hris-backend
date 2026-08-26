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
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { PayrollQueryDto } from './dto/payroll-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('payrolls')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Roles(UserRole.HR_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPayrollDto: CreatePayrollDto) {
    return this.payrollService.create(createPayrollDto);
  }

  @Get()
  async findAll(
    @Query() query: PayrollQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.payrollService.findAll(query, currentUser);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.payrollService.findById(id, currentUser);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id/process')
  @HttpCode(HttpStatus.OK)
  async process(@Param('id') id: string) {
    return this.payrollService.process(id);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id/pay')
  @HttpCode(HttpStatus.OK)
  async pay(@Param('id') id: string) {
    return this.payrollService.pay(id);
  }

  @Roles(UserRole.HR_ADMIN)
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updatePayrollDto: UpdatePayrollDto,
  ) {
    return this.payrollService.update(id, updatePayrollDto);
  }

  @Roles(UserRole.HR_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.payrollService.remove(id);
  }
}
