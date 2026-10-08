import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordAuditLogParams } from './interfaces/audit-log.interface';
import { FindAuditLogsQueryDto } from './dto/audit-log.dto';
import { redactSensitiveFields } from './utils/redaction.util';
import { requestContext } from '../../common/middleware/request-context';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an immutable audit log entry.
   * Automatically redacts sensitive fields in `before` and `after` payloads.
   * Guaranteed non-blocking: errors are logged and swallowed so caller operations never fail.
   */
  async record(
    params: RecordAuditLogParams,
    tx?: Prisma.TransactionClient,
  ) {
    try {
      const redactedBefore =
        params.before !== undefined && params.before !== null
          ? (redactSensitiveFields(params.before) as Prisma.InputJsonValue)
          : Prisma.JsonNull;

      const redactedAfter =
        params.after !== undefined && params.after !== null
          ? (redactSensitiveFields(params.after) as Prisma.InputJsonValue)
          : Prisma.JsonNull;

      const req = requestContext.getStore() as any;
      let { ipAddress, userAgent, correlationId, actorId, actorEmail, actorRole } = params;
      
      if (req) {
        if (!ipAddress) ipAddress = req.ip || req.headers['x-forwarded-for'];
        if (!userAgent) userAgent = req.headers['user-agent'];
        if (!correlationId) correlationId = req.correlationId;
        
        if (req.user) {
          if (!actorId) actorId = req.user.id;
          if (!actorEmail) actorEmail = req.user.email;
          if (!actorRole) actorRole = req.user.role;
        }
      }

      const client = tx ?? this.prisma;
      return await client.auditLog.create({
        data: {
          actorId: actorId ?? null,
          actorEmail: actorEmail ?? null,
          actorRole: actorRole ?? null,
          action: params.action,
          entity: params.entity,
          entityId: String(params.entityId),
          before: redactedBefore,
          after: redactedAfter,
          source: params.source ?? 'USER',
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          correlationId: correlationId ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit log for action "${params?.action}" on entity "${params?.entity}":`,
        error,
      );
      if (tx) {
        throw error;
      }
      return null;
    }
  }

  /**
   * Alias for record() to support standard naming across modules.
   */
  async log(params: RecordAuditLogParams) {
    return this.record(params);
  }

  /**
   * Retrieves paginated audit logs with optional filters.
   */
  async findMany(query: FindAuditLogsQueryDto = {}) {
    const {
      entity,
      entityId,
      action,
      actorId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = query;

    const where: Prisma.AuditLogWhereInput = {};

    if (entity) {
      where.entity = entity;
    }
    if (entityId) {
      where.entityId = entityId;
    }
    if (action) {
      where.action = action;
    }
    if (actorId) {
      where.actorId = actorId;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }
    
    if (search) {
      where.OR = [
        { actorEmail: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves a single audit log entry by ID.
   */
  async findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
    });
  }
}
