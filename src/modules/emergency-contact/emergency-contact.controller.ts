import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { EmergencyContactService } from './emergency-contact.service';
import { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';

@Controller('employees/:employeeId/emergency-contacts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmergencyContactController {
  constructor(
    private readonly emergencyContactService: EmergencyContactService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateEmergencyContactDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.emergencyContactService.create(employeeId, dto, currentUser);
  }

  @Get()
  findByEmployeeId(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.emergencyContactService.findByEmployeeId(
      employeeId,
      currentUser,
    );
  }

  @Patch(':id')
  update(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmergencyContactDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.emergencyContactService.update(
      employeeId,
      id,
      dto,
      currentUser,
    );
  }

  @Delete(':id')
  delete(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.emergencyContactService.delete(employeeId, id, currentUser);
  }
}
