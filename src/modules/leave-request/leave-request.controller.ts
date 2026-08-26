import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { LeaveRequestService } from './leave-request.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { LeaveRequestQueryDto } from './dto/leave-request-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('leave-requests')
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() createLeaveRequestDto: CreateLeaveRequestDto,
  ) {
    return this.leaveRequestService.create(currentUser, createLeaveRequestDto);
  }

  @Get()
  async findAll(
    @Query() query: LeaveRequestQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.leaveRequestService.findAll(query, currentUser);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.leaveRequestService.findById(id, currentUser);
  }

  @Roles(UserRole.HR_ADMIN, UserRole.MANAGER)
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.leaveRequestService.approve(id, currentUser);
  }

  @Roles(UserRole.HR_ADMIN, UserRole.MANAGER)
  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() rejectLeaveRequestDto: RejectLeaveRequestDto,
  ) {
    return this.leaveRequestService.reject(id, currentUser, rejectLeaveRequestDto);
  }
}
