import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MovementHistoryService } from './movement-history.service';

@Controller('employees/:employeeId/movement-history')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MovementHistoryController {
  constructor(private readonly service: MovementHistoryService) {}

  @Get()
  async findByEmployeeId(
    @Param('employeeId') employeeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.findByEmployeeId(employeeId, currentUser);
  }
}
