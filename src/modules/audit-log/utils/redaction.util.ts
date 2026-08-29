const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'tokenhash',
  'token_hash',
  'refreshtoken',
  'refresh_token',
  'basesalary',
  'base_salary',
  'basicsalary',
  'basic_salary',
  'netsalary',
  'net_salary',
  'allowances',
  'deductions',
  'amount',
  'npwp',
  'bpjs',
  'bpjskes',
  'bpjs_kes',
  'bpjstk',
  'bpjs_tk',
  'ktp',
  'storagepath',
  'storage_path',
]);

export const REDACTED_PLACEHOLDER = '[REDACTED]';

/**
 * Checks if a given field name is sensitive and should be redacted.
 */
export function isSensitiveField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return SENSITIVE_FIELD_NAMES.has(normalized);
}

/**
 * Recursively redacts sensitive fields in an object or array.
 * Non-sensitive fields and primitives are preserved.
 * Does not mutate the original data.
 */
export function redactSensitiveFields<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitives, functions, dates, etc.
  if (typeof data !== 'object') {
    return data;
  }

  if (data instanceof Date) {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data;
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveFields(item)) as unknown as T;
  }

  // Handle Objects
  const result: Record<string, unknown> = {};
  const entries = Object.entries(data as Record<string, unknown>);

  for (const [key, value] of entries) {
    if (isSensitiveField(key)) {
      result[key] = REDACTED_PLACEHOLDER;
    } else if (value !== null && typeof value === 'object') {
      result[key] = redactSensitiveFields(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
