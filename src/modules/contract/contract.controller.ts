import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ContractService } from './contract.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';

@Controller('employees/:employeeId/contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractController {
  constructor(private readonly service: ContractService) {}

  @Post()
  @Roles(UserRole.HR_ADMIN)
  async create(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateContractDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.create(employeeId, dto, currentUser);
  }

  @Get()
  async findMany(
    @Param('employeeId') employeeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.findByEmployeeId(employeeId, currentUser);
  }

  @Get(':id')
  async findById(
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.findById(employeeId, id, currentUser);
  }

  @Patch(':id/status')
  @Roles(UserRole.HR_ADMIN)
  async updateStatus(
    @Param('employeeId') employeeId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContractStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.updateStatus(employeeId, id, dto, currentUser);
  }
}
