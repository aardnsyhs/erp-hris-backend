import { AssignmentType } from '@prisma/client';

export class PositionAssignmentResponseDto {
  id: string;
  employeeId: string;
  positionId: string;
  position?: {
    id: string;
    code: string;
    title: string;
    level: number;
  } | null;
  departmentId: string;
  department?: {
    id: string;
    code: string;
    name: string;
  } | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  assignmentType: AssignmentType;
  notes?: string | null;
  assignedById: string;
  assignedBy?: {
    id: string;
    email: string;
    role: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}
