import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ContractStatus, UserRole } from '@prisma/client';
import { ContractRepository } from './contract.repository';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';
import { ContractResponseDto } from './dto/contract-response.dto';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    private readonly repository: ContractRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    employeeId: string,
    dto: CreateContractDto,
    currentUser: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee || employee.deletedAt !== null) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const existingNumber = await this.repository.findByContractNumber(
      dto.contractNumber.trim(),
    );
    if (existingNumber) {
      throw new ConflictException(
        `Nomor kontrak '${dto.contractNumber}' sudah digunakan`,
      );
    }

    const startDate = new Date(dto.startDate);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Format tanggal startDate tidak valid');
    }

    let endDate: Date | null = null;
    if (dto.endDate) {
      endDate = new Date(dto.endDate);
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException('Format tanggal endDate tidak valid');
      }
      if (endDate < startDate) {
        throw new BadRequestException(
          'Tanggal selesai kontrak (endDate) tidak boleh lebih awal dari tanggal mulai (startDate)',
        );
      }
    }

    let renewalReminderDate: Date | null = null;
    if (dto.renewalReminderDate) {
      renewalReminderDate = new Date(dto.renewalReminderDate);
      if (isNaN(renewalReminderDate.getTime())) {
        throw new BadRequestException(
          'Format tanggal renewalReminderDate tidak valid',
        );
      }
    }

    if (dto.documentId) {
      const doc = await this.repository.findDocumentById(dto.documentId);
      if (!doc || doc.employeeId !== employeeId || doc.deletedAt !== null) {
        throw new BadRequestException(
          `Dokumen lampiran dengan ID '${dto.documentId}' tidak valid untuk karyawan ini`,
        );
      }
    }

    const status = dto.status || ContractStatus.ACTIVE;

    // No-overlap validation untuk kontrak ACTIVE
    if (status === ContractStatus.ACTIVE) {
      const overlapping =
        await this.repository.findOverlappingActiveContract(
          employeeId,
          startDate,
          endDate,
        );
      if (overlapping) {
        throw new ConflictException(
          `Terdapat kontrak aktif '${overlapping.contractNumber}' yang overlap pada rentang tanggal tersebut`,
        );
      }
    }

    const created = await this.repository.create({
      employeeId,
      contractType: dto.contractType,
      contractNumber: dto.contractNumber.trim(),
      startDate,
      endDate,
      status,
      renewalReminderDate,
      notes: dto.notes?.trim() || null,
      documentId: dto.documentId || null,
    });

    const response = this.mapToResponse(created);

    try {
      await this.auditLogService.record({
        action: 'CREATE_CONTRACT',
        entity: 'EmploymentContract',
        entityId: created.id,
        actorId: currentUser.userId,
        after: response as any,
        source: 'USER',
      });
    } catch (err: any) {
      this.logger.error('Gagal mencatat audit log create contract', err?.stack);
    }

    return response;
  }

  async updateStatus(
    employeeId: string,
    id: string,
    dto: UpdateContractStatusDto,
    currentUser: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    const contract = await this.repository.findById(id);
    if (!contract || contract.employeeId !== employeeId) {
      throw new NotFoundException(`Kontrak dengan ID '${id}' tidak ditemukan`);
    }

    // Immutable transition guard: EXPIRED, TERMINATED, RENEWED tidak bisa kembali ke ACTIVE
    const terminalStatuses: ContractStatus[] = [
      ContractStatus.EXPIRED,
      ContractStatus.TERMINATED,
      ContractStatus.RENEWED,
    ];

    if (
      terminalStatuses.includes(contract.status) &&
      dto.status === ContractStatus.ACTIVE
    ) {
      throw new BadRequestException(
        `Kontrak dengan status '${contract.status}' bersifat immutable dan tidak dapat diubah kembali ke status ACTIVE`,
      );
    }

    const updated = await this.repository.updateStatus(
      id,
      dto.status,
      dto.notes,
    );

    const response = this.mapToResponse(updated);

    try {
      await this.auditLogService.record({
        action: 'UPDATE_CONTRACT_STATUS',
        entity: 'EmploymentContract',
        entityId: updated.id,
        actorId: currentUser.userId,
        before: contract as any,
        after: response as any,
        source: 'USER',
      });
    } catch (err: any) {
      this.logger.error(
        'Gagal mencatat audit log update contract status',
        err?.stack,
      );
    }

    return response;
  }

  async findByEmployeeId(
    employeeId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ data: ContractResponseDto[] }> {
    await this.assertAccess(employeeId, currentUser);

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const contracts =
      await this.repository.findManyByEmployeeId(employeeId);
    return {
      data: contracts.map((c) => this.mapToResponse(c)),
    };
  }

  async findById(
    employeeId: string,
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<ContractResponseDto> {
    await this.assertAccess(employeeId, currentUser);

    const contract = await this.repository.findById(id);
    if (!contract || contract.employeeId !== employeeId) {
      throw new NotFoundException(`Kontrak dengan ID '${id}' tidak ditemukan`);
    }

    return this.mapToResponse(contract);
  }

  private mapToResponse(contract: any): ContractResponseDto {
    return {
      id: contract.id,
      employeeId: contract.employeeId,
      contractType: contract.contractType,
      contractNumber: contract.contractNumber,
      startDate: contract.startDate,
      endDate: contract.endDate,
      status: contract.status,
      renewalReminderDate: contract.renewalReminderDate,
      notes: contract.notes,
      documentId: contract.documentId,
      document: contract.document
        ? {
            id: contract.document.id,
            title: contract.document.title,
            fileName: contract.document.fileName,
            mimeType: contract.document.mimeType,
            fileSizeBytes: contract.document.fileSizeBytes,
          }
        : null,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  private async assertAccess(
    employeeId: string,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role === UserRole.HR_ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.EMPLOYEE) {
      if (currentUser.employeeId !== employeeId) {
        throw new ForbiddenException(
          'Anda hanya dapat melihat kontrak kerja Anda sendiri',
        );
      }
      return;
    }

    // MANAGER tidak memiliki akses ke kontrak kerja (informasi kompensasi/hukum privat)
    if (currentUser.role === UserRole.MANAGER) {
      throw new ForbiddenException(
        'Manager tidak memiliki izin untuk mengakses dokumen kontrak kerja karyawan',
      );
    }
  }
}
