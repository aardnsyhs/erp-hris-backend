export interface RecordAuditLogParams {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | unknown | null;
  after?: Record<string, unknown> | unknown | null;
  source?: 'USER' | 'SYSTEM' | 'API' | string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}
