import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ReportingLineService } from './reporting-line.service';
import { CreateReportingLineDto } from './dto/create-reporting-line.dto';

@Controller('employees/:employeeId/reporting-lines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportingLineController {
  constructor(private readonly service: ReportingLineService) {}

  @Post()
  @Roles(UserRole.HR_ADMIN)
  async create(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateReportingLineDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.create(employeeId, dto, currentUser);
  }

  @Get('current')
  async findActive(
    @Param('employeeId') employeeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.findActiveByEmployeeId(employeeId, currentUser);
  }

  @Get()
  async findHistory(
    @Param('employeeId') employeeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.findHistoryByEmployeeId(employeeId, currentUser);
  }
}
