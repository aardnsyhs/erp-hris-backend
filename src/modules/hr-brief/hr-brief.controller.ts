import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { HrBriefQueryDto } from './dto/hr-brief-query.dto';
import { HrBriefService } from './hr-brief.service';
import { HR_BRIEF_RESPONSE_SCHEMA } from './dto/hr-brief-response.dto';
import type { HrBriefResponseDto } from './dto/hr-brief-response.dto';

@ApiTags('HR Brief')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.HR_ADMIN)
@Controller('hr-brief')
export class HrBriefController {
  constructor(private readonly service: HrBriefService) {}

  @Get()
  @ApiOperation({
    summary: 'Operational summary for HR_ADMIN',
    description:
      'Attendance follows the selected period. Open work is independent of that period. Details are limited to 20 per category with actual totals and remaining counts. Payroll groups include all periods; no salary or leave reason is exposed.',
  })
  @ApiResponse({
    status: 200,
    schema: HR_BRIEF_RESPONSE_SCHEMA,
    description:
      'Period, WIB reference date, generatedAt, attendance aggregates and current open work',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid calendar date or period outside 1–90 days',
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'HR_ADMIN only' })
  read(@Query() query: HrBriefQueryDto): Promise<HrBriefResponseDto> {
    return this.service.read(query);
  }
}
