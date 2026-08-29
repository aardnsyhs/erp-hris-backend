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
import { PositionAssignmentService } from './position-assignment.service';
import { CreatePositionAssignmentDto } from './dto/create-position-assignment.dto';

@Controller('employees/:employeeId/position-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PositionAssignmentController {
  constructor(private readonly service: PositionAssignmentService) {}

  @Post()
  @Roles(UserRole.HR_ADMIN)
  async create(
    @Param('employeeId') employeeId: string,
    @Body() dto: CreatePositionAssignmentDto,
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
