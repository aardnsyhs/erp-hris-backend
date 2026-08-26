import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'erp-hris-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
