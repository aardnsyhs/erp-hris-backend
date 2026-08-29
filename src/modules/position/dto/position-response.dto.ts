export class PositionResponseDto {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  level: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
