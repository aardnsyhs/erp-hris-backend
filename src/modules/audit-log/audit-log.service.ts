import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecordAuditLogParams } from './interfaces/audit-log.interface';
import { FindAuditLogsQueryDto } from './dto/audit-log.dto';
import { redactSensitiveFields } from './utils/redaction.util';

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

      const client = tx ?? this.prisma;
      return await client.auditLog.create({
        data: {
          actorId: params.actorId ?? null,
          actorEmail: params.actorEmail ?? null,
          actorRole: params.actorRole ?? null,
          action: params.action,
          entity: params.entity,
          entityId: String(params.entityId),
          before: redactedBefore,
          after: redactedAfter,
          source: params.source ?? 'USER',
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          correlationId: params.correlationId ?? null,
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
