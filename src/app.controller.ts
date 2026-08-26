import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Health check service',
    description: 'Mengembalikan status kesehatan backend service.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service berjalan normal',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'erp-hris-backend' },
        timestamp: { type: 'string', example: '2026-08-26T08:15:00.000Z' },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
