import {
  redactSensitiveFields,
  isSensitiveField,
  REDACTED_PLACEHOLDER,
} from './redaction.util';

describe('RedactionUtil', () => {
  describe('isSensitiveField', () => {
    it('should identify sensitive field names in various casings', () => {
      expect(isSensitiveField('password')).toBe(true);
      expect(isSensitiveField('passwordHash')).toBe(true);
      expect(isSensitiveField('password_hash')).toBe(true);
      expect(isSensitiveField('tokenHash')).toBe(true);
      expect(isSensitiveField('baseSalary')).toBe(true);
      expect(isSensitiveField('basic_salary')).toBe(true);
      expect(isSensitiveField('netSalary')).toBe(true);
      expect(isSensitiveField('allowances')).toBe(true);
      expect(isSensitiveField('deductions')).toBe(true);
      expect(isSensitiveField('amount')).toBe(true);
      expect(isSensitiveField('npwp')).toBe(true);
      expect(isSensitiveField('bpjs')).toBe(true);
      expect(isSensitiveField('bpjsKes')).toBe(true);
      expect(isSensitiveField('bpjs_tk')).toBe(true);
      expect(isSensitiveField('ktp')).toBe(true);
      expect(isSensitiveField('storagePath')).toBe(true);
    });

    it('should return false for non-sensitive fields', () => {
      expect(isSensitiveField('id')).toBe(false);
      expect(isSensitiveField('fullName')).toBe(false);
      expect(isSensitiveField('email')).toBe(false);
      expect(isSensitiveField('jobTitle')).toBe(false);
      expect(isSensitiveField('hireDate')).toBe(false);
      expect(isSensitiveField('status')).toBe(false);
    });
  });

  describe('redactSensitiveFields', () => {
    it('should return null or undefined as-is', () => {
      expect(redactSensitiveFields(null)).toBeNull();
      expect(redactSensitiveFields(undefined)).toBeUndefined();
    });

    it('should return primitives as-is', () => {
      expect(redactSensitiveFields(123)).toBe(123);
      expect(redactSensitiveFields('hello')).toBe('hello');
      expect(redactSensitiveFields(true)).toBe(true);
    });

    it('should preserve Date objects', () => {
      const now = new Date();
      expect(redactSensitiveFields(now)).toEqual(now);
    });

    it('should redact sensitive fields in a flat object', () => {
      const employee = {
        id: 'emp-1',
        fullName: 'Budi Santoso',
        email: 'budi@example.com',
        baseSalary: 10000000,
        passwordHash: 'secret$hash',
        status: 'ACTIVE',
      };

      const redacted = redactSensitiveFields(employee);

      expect(redacted).toEqual({
        id: 'emp-1',
        fullName: 'Budi Santoso',
        email: 'budi@example.com',
        baseSalary: REDACTED_PLACEHOLDER,
        passwordHash: REDACTED_PLACEHOLDER,
        status: 'ACTIVE',
      });
      // Original object should not be modified
      expect(employee.baseSalary).toBe(10000000);
    });

    it('should recursively redact sensitive fields in nested objects', () => {
      const payload = {
        user: {
          id: 'user-1',
          email: 'admin@company.com',
          passwordHash: 'argon2$123',
          profile: {
            ktp: '3201234567890001',
            npwp: '01.234.567.8-901.000',
            address: 'Jakarta',
          },
        },
        compensation: {
          basicSalary: 15000000,
          allowances: 2000000,
          netSalary: 16500000,
        },
      };

      const redacted = redactSensitiveFields(payload);

      expect(redacted.user.passwordHash).toBe(REDACTED_PLACEHOLDER);
      expect(redacted.user.profile.ktp).toBe(REDACTED_PLACEHOLDER);
      expect(redacted.user.profile.npwp).toBe(REDACTED_PLACEHOLDER);
      expect(redacted.user.profile.address).toBe('Jakarta');
      expect(redacted.compensation.basicSalary).toBe(REDACTED_PLACEHOLDER);
      expect(redacted.compensation.allowances).toBe(REDACTED_PLACEHOLDER);
      expect(redacted.compensation.netSalary).toBe(REDACTED_PLACEHOLDER);
    });

    it('should recursively redact sensitive fields inside arrays', () => {
      const items = [
        { id: '1', name: 'Item 1', amount: 5000 },
        { id: '2', name: 'Item 2', storagePath: '/private/docs/1.pdf' },
      ];

      const redacted = redactSensitiveFields(items);

      expect(redacted).toEqual([
        { id: '1', name: 'Item 1', amount: REDACTED_PLACEHOLDER },
        { id: '2', name: 'Item 2', storagePath: REDACTED_PLACEHOLDER },
      ]);
    });
  });
});
