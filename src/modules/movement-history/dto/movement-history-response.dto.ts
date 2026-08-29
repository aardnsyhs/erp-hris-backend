import { MovementType } from '@prisma/client';

export class MovementHistoryResponseDto {
  id: string;
  employeeId: string;
  movementType: MovementType;
  fromPositionId?: string | null;
  fromPosition?: {
    id: string;
    code: string;
    title: string;
    level: number;
  } | null;
  toPositionId?: string | null;
  toPosition?: {
    id: string;
    code: string;
    title: string;
    level: number;
  } | null;
  fromDepartmentId?: string | null;
  fromDepartment?: {
    id: string;
    code: string;
    name: string;
  } | null;
  toDepartmentId?: string | null;
  toDepartment?: {
    id: string;
    code: string;
    name: string;
  } | null;
  effectiveDate: Date;
  reason?: string | null;
  performedById: string;
  performedBy?: {
    id: string;
    email: string;
    role: string;
  } | null;
  createdAt: Date;
}
