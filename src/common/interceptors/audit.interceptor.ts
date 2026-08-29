import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import {
  AUDITED_METADATA_KEY,
  AuditedOptions,
} from '../decorators/audited.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<AuditedOptions>(
      AUDITED_METADATA_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    const correlationId: string | undefined = request.correlationId;
    const ipAddress: string | undefined =
      request.ip || request.headers['x-forwarded-for'];
    const userAgent: string | undefined = request.headers['user-agent'];

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const entityId = options.getEntityId
            ? options.getEntityId(request, response)
            : request.params?.id ||
              response?.id ||
              request.params?.employeeId ||
              'UNKNOWN';

          await this.auditLogService.record({
            actorId: user?.userId ?? null,
            actorEmail: user?.email ?? null,
            actorRole: user?.role ?? null,
            action: options.action,
            entity: options.entity,
            entityId: String(entityId),
            before: request.body ?? null,
            after: response ?? null,
            source: 'API',
            ipAddress,
            userAgent,
            correlationId,
          });
        } catch (error) {
          // Failure in audit logging must not crash primary response
          // but can be logged via console/logger
          console.error('[AuditInterceptor] Failed to record audit log:', error);
        }
      }),
    );
  }
}
