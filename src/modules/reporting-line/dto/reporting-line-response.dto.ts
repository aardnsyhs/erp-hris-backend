export class ReportingLineResponseDto {
  id: string;
  employeeId: string;
  managerId: string;
  manager?: {
    id: string;
    nip: string;
    fullName: string;
    jobTitle: string;
    email: string;
  } | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}
