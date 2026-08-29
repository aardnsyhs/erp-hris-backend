import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDACTED_PLACEHOLDER } from './utils/redaction.util';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: PrismaService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('immutability guard', () => {
    it('should NOT expose any update or delete methods', () => {
      expect((service as any).update).toBeUndefined();
      expect((service as any).delete).toBeUndefined();
      expect((service as any).patch).toBeUndefined();
      expect((service as any).remove).toBeUndefined();
    });
  });

  describe('record()', () => {
    it('should record an audit log with redacted sensitive fields', async () => {
      const mockResult = {
        id: 'audit-1',
        actorId: 'user-1',
        actorEmail: 'admin@company.com',
        actorRole: 'HR_ADMIN',
        action: 'UPDATE',
        entity: 'Employee',
        entityId: 'emp-100',
        before: {
          id: 'emp-100',
          baseSalary: REDACTED_PLACEHOLDER,
          passwordHash: REDACTED_PLACEHOLDER,
          fullName: 'Budi',
        },
        after: {
          id: 'emp-100',
          baseSalary: REDACTED_PLACEHOLDER,
          passwordHash: REDACTED_PLACEHOLDER,
          fullName: 'Budi Updated',
        },
        source: 'USER',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        correlationId: 'req-123',
        createdAt: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(mockResult);

      const result = await service.record({
        actorId: 'user-1',
        actorEmail: 'admin@company.com',
        actorRole: 'HR_ADMIN',
        action: 'UPDATE',
        entity: 'Employee',
        entityId: 'emp-100',
        before: {
          id: 'emp-100',
          baseSalary: 10000000,
          passwordHash: 'secret-hash',
          fullName: 'Budi',
        },
        after: {
          id: 'emp-100',
          baseSalary: 12000000,
          passwordHash: 'secret-hash-2',
          fullName: 'Budi Updated',
        },
        source: 'USER',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        correlationId: 'req-123',
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'user-1',
          action: 'UPDATE',
          entity: 'Employee',
          entityId: 'emp-100',
          before: {
            id: 'emp-100',
            baseSalary: REDACTED_PLACEHOLDER,
            passwordHash: REDACTED_PLACEHOLDER,
            fullName: 'Budi',
          },
          after: {
            id: 'emp-100',
            baseSalary: REDACTED_PLACEHOLDER,
            passwordHash: REDACTED_PLACEHOLDER,
            fullName: 'Budi Updated',
          },
        }),
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle system action without actor', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-2' });

      await service.record({
        action: 'ACCRUAL',
        entity: 'LeaveBalance',
        entityId: 'lb-1',
        source: 'SYSTEM',
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: null,
          actorEmail: null,
          actorRole: null,
          action: 'ACCRUAL',
          entity: 'LeaveBalance',
          entityId: 'lb-1',
          source: 'SYSTEM',
        }),
      });
    });
  });

  describe('findMany()', () => {
    it('should query audit logs with pagination and filters', async () => {
      const mockLogs = [{ id: '1' }, { id: '2' }];
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(2);

      const result = await service.findMany({
        entity: 'Employee',
        action: 'UPDATE',
        page: 1,
        limit: 10,
      });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entity: 'Employee',
          action: 'UPDATE',
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({
        data: mockLogs,
        meta: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });
  });

  describe('findById()', () => {
    it('should retrieve a log by id', async () => {
      const mockLog = { id: 'log-1', action: 'LOGIN' };
      mockPrismaService.auditLog.findUnique.mockResolvedValue(mockLog);

      const result = await service.findById('log-1');

      expect(mockPrismaService.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'log-1' },
      });
      expect(result).toEqual(mockLog);
    });
  });
});
