import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PositionService } from './position.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { PositionQueryDto } from './dto/position-query.dto';

@Controller('positions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PositionController {
  constructor(private readonly service: PositionService) {}

  @Post()
  @Roles(UserRole.HR_ADMIN)
  async create(
    @Body() dto: CreatePositionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.create(dto, currentUser);
  }

  @Get()
  async findMany(@Query() query: PositionQueryDto) {
    return this.service.findMany(query);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.HR_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, currentUser);
  }
}
