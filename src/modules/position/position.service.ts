import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PositionRepository } from './position.repository';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { PositionQueryDto } from './dto/position-query.dto';
import { PositionResponseDto } from './dto/position-response.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class PositionService {
  private readonly logger = new Logger(PositionService.name);

  constructor(
    private readonly repository: PositionRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    dto: CreatePositionDto,
    currentUser: AuthenticatedUser,
  ): Promise<PositionResponseDto> {
    const existing = await this.repository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException(
        `Posisi dengan kode '${dto.code}' sudah terdaftar`,
      );
    }

    const created = await this.repository.create({
      code: dto.code.trim().toUpperCase(),
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      level: dto.level,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    try {
      await this.auditLogService.record({
        action: 'CREATE_POSITION',
        entity: 'Position',
        entityId: created.id,
        actorId: currentUser.userId,
        after: created as any,
        source: 'USER',
      });
    } catch (err: any) {
      this.logger.error('Gagal mencatat audit log create position', err?.stack);
    }

    return created;
  }

  async update(
    id: string,
    dto: UpdatePositionDto,
    currentUser: AuthenticatedUser,
  ): Promise<PositionResponseDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Posisi dengan ID '${id}' tidak ditemukan`);
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      const duplicate = await this.repository.findByCode(
        dto.code.trim().toUpperCase(),
      );
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `Posisi dengan kode '${dto.code}' sudah terdaftar`,
        );
      }
    }

    const updated = await this.repository.update(id, {
      code: dto.code ? dto.code.trim().toUpperCase() : undefined,
      title: dto.title ? dto.title.trim() : undefined,
      description:
        dto.description !== undefined ? dto.description.trim() || null : undefined,
      level: dto.level !== undefined ? dto.level : undefined,
      isActive: dto.isActive !== undefined ? dto.isActive : undefined,
    });

    try {
      await this.auditLogService.record({
        action: 'UPDATE_POSITION',
        entity: 'Position',
        entityId: updated.id,
        actorId: currentUser.userId,
        before: existing as any,
        after: updated as any,
        source: 'USER',
      });
    } catch (err: any) {
      this.logger.error('Gagal mencatat audit log update position', err?.stack);
    }

    return updated;
  }

  async findById(id: string): Promise<PositionResponseDto> {
    const position = await this.repository.findById(id);
    if (!position) {
      throw new NotFoundException(`Posisi dengan ID '${id}' tidak ditemukan`);
    }
    return position;
  }

  async findMany(query: PositionQueryDto): Promise<{ data: PositionResponseDto[] }> {
    const data = await this.repository.findMany({
      search: query.search,
      isActive: query.isActive,
    });
    return { data };
  }
}
