import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import { AUDITED_METADATA_KEY } from '../decorators/audited.decorator';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let reflector: Reflector;
  let auditLogService: AuditLogService;

  beforeEach(() => {
    reflector = {
      get: jest.fn(),
    } as unknown as Reflector;

    auditLogService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    } as unknown as AuditLogService;

    interceptor = new AuditInterceptor(reflector, auditLogService);
  });

  it('should pass through without audit logging if @Audited metadata is missing', (done) => {
    (reflector.get as jest.Mock).mockReturnValue(undefined);

    const context = {
      getHandler: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(context, next).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
        expect(auditLogService.record).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should record audit log on handler completion when @Audited is present', (done) => {
    (reflector.get as jest.Mock).mockReturnValue({
      entity: 'Employee',
      action: 'UPDATE',
    });

    const mockRequest = {
      user: {
        userId: 'user-1',
        email: 'hr@example.com',
        role: 'HR_ADMIN',
      },
      params: { id: 'emp-10' },
      body: { fullName: 'New Name' },
      ip: '192.168.1.1',
      headers: { 'user-agent': 'JestClient/1.0' },
      correlationId: 'corr-999',
    };

    const context = {
      getHandler: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const responsePayload = { id: 'emp-10', fullName: 'New Name' };
    const next: CallHandler = {
      handle: () => of(responsePayload),
    };

    interceptor.intercept(context, next).subscribe({
      next: (val) => {
        expect(val).toEqual(responsePayload);
        expect(auditLogService.record).toHaveBeenCalledWith({
          actorId: 'user-1',
          actorEmail: 'hr@example.com',
          actorRole: 'HR_ADMIN',
          action: 'UPDATE',
          entity: 'Employee',
          entityId: 'emp-10',
          before: { fullName: 'New Name' },
          after: responsePayload,
          source: 'API',
          ipAddress: '192.168.1.1',
          userAgent: 'JestClient/1.0',
          correlationId: 'corr-999',
        });
        done();
      },
    });
  });
});
