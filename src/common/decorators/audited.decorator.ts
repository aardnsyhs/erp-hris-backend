import { SetMetadata } from '@nestjs/common';

export const AUDITED_METADATA_KEY = 'AUDITED_METADATA_KEY';

export interface AuditedOptions {
  entity: string;
  action: string;
  getEntityId?: (req: any, responseData: any) => string;
}

/**
 * Decorator to mark a controller method for automated audit logging.
 *
 * @example
 * @Audited({ entity: 'Employee', action: 'UPDATE' })
 */
export const Audited = (options: AuditedOptions) =>
  SetMetadata(AUDITED_METADATA_KEY, options);
