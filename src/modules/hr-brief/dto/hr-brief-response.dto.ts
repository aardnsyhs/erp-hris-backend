import type { SchemaObject } from '@nestjs/swagger';
import type { HrBriefService } from '../hr-brief.service';

export type HrBriefResponseDto = Awaited<ReturnType<HrBriefService['read']>>;
const day: SchemaObject = { type: 'string', format: 'date' };
const timestamp: SchemaObject = { type: 'string', format: 'date-time' };
const count: SchemaObject = { type: 'integer', minimum: 0 };
const employee: SchemaObject = {
  type: 'object',
  required: ['id', 'nip', 'fullName'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    nip: { type: 'string' },
    fullName: { type: 'string' },
  },
};
const source: Record<string, SchemaObject> = {
  id: { type: 'string', format: 'uuid' },
  employeeId: { type: 'string', format: 'uuid' },
  employee,
};
const contract: SchemaObject = {
  type: 'object',
  properties: { ...source, contractNumber: { type: 'string' }, endDate: day },
};
const payrollPeriod: Record<string, SchemaObject> = {
  periodStart: day,
  periodEnd: day,
  status: { type: 'string', enum: ['DRAFT', 'PROCESSED'] },
};
function collection(item: SchemaObject): SchemaObject {
  return {
    type: 'object',
    required: ['total', 'items', 'remaining', 'limit'],
    properties: {
      total: count,
      items: { type: 'array', items: item },
      remaining: count,
      limit: { type: 'integer', example: 20 },
    },
  };
}
const payrollCollection = collection({
  type: 'object',
  properties: { ...source, ...payrollPeriod },
});

export const HR_BRIEF_RESPONSE_SCHEMA: SchemaObject = {
  type: 'object',
  required: [
    'period',
    'referenceDate',
    'timezone',
    'generatedAt',
    'departmentId',
    'contractHorizon',
    'attendance',
    'open',
  ],
  properties: {
    period: {
      type: 'object',
      required: ['startDate', 'endDate'],
      properties: { startDate: day, endDate: day },
    },
    referenceDate: {
      ...day,
      description: 'Current WIB calendar date, independent of recap filters',
    },
    timezone: { type: 'string', enum: ['Asia/Jakarta'] },
    generatedAt: timestamp,
    departmentId: { type: 'string', format: 'uuid', nullable: true },
    contractHorizon: {
      type: 'object',
      properties: { days: { type: 'integer', example: 30 }, endDate: day },
    },
    attendance: {
      type: 'object',
      description:
        'Only recorded employee-days; missing records are not ABSENT',
      properties: {
        PRESENT: count,
        LATE: count,
        ABSENT: count,
        recordedEmployeeDays: count,
      },
    },
    open: {
      type: 'object',
      properties: {
        total: count,
        leaves: collection({
          type: 'object',
          properties: {
            ...source,
            startDate: day,
            endDate: day,
            createdAt: timestamp,
            datesPassed: { type: 'boolean' },
          },
        }),
        upcomingContracts: collection(contract),
        expiredActiveContracts: collection(contract),
        payrolls: {
          ...payrollCollection,
          properties: {
            ...payrollCollection.properties,
            groups: {
              type: 'array',
              description: 'All period/status groups, not paginated',
              items: {
                type: 'object',
                properties: { ...payrollPeriod, total: count },
              },
            },
          },
        },
      },
    },
  },
};
