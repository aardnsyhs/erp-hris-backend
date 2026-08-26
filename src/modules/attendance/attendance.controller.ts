import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('attendances')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(HttpStatus.CREATED)
  async checkIn(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() checkInDto: CheckInDto,
  ) {
    return this.attendanceService.checkIn(currentUser, checkInDto);
  }

  @Patch('check-out')
  @HttpCode(HttpStatus.OK)
  async checkOut(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() checkOutDto: CheckOutDto,
  ) {
    return this.attendanceService.checkOut(currentUser, checkOutDto);
  }

  @Get()
  async findAll(
    @Query() query: AttendanceQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.attendanceService.findAll(query, currentUser);
  }
}
