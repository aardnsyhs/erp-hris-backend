import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DocumentType, EmployeeDocument, ScanStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { StorageService } from '../../common/storage/storage.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EmployeeDocumentRepository } from './employee-document.repository';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { DocumentResponseDto } from './dto/document-response.dto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@Injectable()
export class EmployeeDocumentService {
  constructor(
    private readonly repository: EmployeeDocumentRepository,
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private sanitizeFileName(originalName: string): string {
    const baseName = path.basename(originalName);
    // Replace non-alphanumeric (except . - _) with _
    return baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private mapToResponse(doc: EmployeeDocument): DocumentResponseDto {
    return {
      id: doc.id,
      employeeId: doc.employeeId,
      documentType: doc.documentType,
      title: doc.title,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      scanStatus: doc.scanStatus,
      expiryDate: doc.expiryDate,
      uploadedById: doc.uploadedById,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private async assertReadAccess(
    employeeId: string,
    currentUser: AuthenticatedUser,
  ) {
    if (currentUser.role === UserRole.HR_ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.EMPLOYEE) {
      if (currentUser.employeeId !== employeeId) {
        throw new ForbiddenException(
          'Anda hanya dapat mengakses dokumen milik Anda sendiri',
        );
      }
      return;
    }

    throw new ForbiddenException(
      'Manager atau role lain tidak memiliki akses ke dokumen karyawan',
    );
  }

  async upload(
    employeeId: string,
    dto: CreateDocumentDto,
    file: Express.Multer.File,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('File dokumen wajib diunggah');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipe file tidak didukung (${file.mimetype}). Hanya file PDF, JPEG, PNG, dan WEBP yang diizinkan.`,
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `Ukuran file (${file.size} bytes) melebihi batas maksimal 10MB`,
      );
    }

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const sanitizedFileName = this.sanitizeFileName(
      file.originalname || 'document.bin',
    );

    const uploadResult = await this.storageService.upload({
      buffer: file.buffer,
      filename: sanitizedFileName,
      mimeType: file.mimetype,
      destinationDirectory: `documents/${employeeId}`,
    });

    const storagePath = uploadResult.storagePath;

    const created = await this.repository.create({
      employeeId,
      documentType: dto.documentType,
      title: dto.title,
      fileName: sanitizedFileName,
      storagePath,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      scanStatus: ScanStatus.CLEAN,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      uploadedById: currentUser.userId,
    });

    const response = this.mapToResponse(created);

    await this.auditLogService.record({
      action: 'UPLOAD_DOCUMENT',
      entity: 'EmployeeDocument',
      entityId: created.id,
      actorId: currentUser.userId,
      after: response as any,
      source: 'USER',
    });

    return response;
  }

  async findMany(
    employeeId: string,
    query: DocumentQueryDto,
    currentUser: AuthenticatedUser,
  ) {
    await this.assertReadAccess(employeeId, currentUser);

    const employee = await this.repository.findEmployeeById(employeeId);
    if (!employee) {
      throw new NotFoundException(
        `Karyawan dengan ID '${employeeId}' tidak ditemukan`,
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const { data, total } = await this.repository.findMany(employeeId, {
      documentType: query.documentType,
      page,
      limit,
    });

    return {
      data: data.map((doc) => this.mapToResponse(doc)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findById(
    employeeId: string,
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    await this.assertReadAccess(employeeId, currentUser);

    const doc = await this.repository.findById(id);
    if (!doc || doc.employeeId !== employeeId) {
      throw new NotFoundException(`Dokumen dengan ID '${id}' tidak ditemukan`);
    }

    return this.mapToResponse(doc);
  }

  async download(
    employeeId: string,
    id: string,
    currentUser: AuthenticatedUser,
  ) {
    await this.assertReadAccess(employeeId, currentUser);

    const doc = await this.repository.findById(id);
    if (!doc || doc.employeeId !== employeeId) {
      throw new NotFoundException(`Dokumen dengan ID '${id}' tidak ditemukan`);
    }

    if (doc.scanStatus === ScanStatus.QUARANTINED) {
      throw new GoneException(
        'Dokumen tidak dapat diunduh karena terindikasi berbahaya atau sedang dalam karantina keamanan',
      );
    }

    const exists = await this.storageService.exists(doc.storagePath);
    if (!exists) {
      throw new NotFoundException('File binary tidak ditemukan di penyimpanan');
    }

    const stream = await this.storageService.getDownloadStream(doc.storagePath);

    await this.auditLogService.record({
      action: 'DOWNLOAD_DOCUMENT',
      entity: 'EmployeeDocument',
      entityId: doc.id,
      actorId: currentUser.userId,
      source: 'USER',
    });

    return {
      stream,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
    };
  }

  async remove(
    employeeId: string,
    id: string,
    currentUser: AuthenticatedUser,
  ) {
    const doc = await this.repository.findById(id);
    if (!doc || doc.employeeId !== employeeId) {
      throw new NotFoundException(`Dokumen dengan ID '${id}' tidak ditemukan`);
    }

    await this.repository.softDelete(id);

    await this.auditLogService.record({
      action: 'DELETE_DOCUMENT',
      entity: 'EmployeeDocument',
      entityId: id,
      actorId: currentUser.userId,
      before: this.mapToResponse(doc) as any,
      source: 'USER',
    });

    return {
      message: 'Dokumen berhasil dihapus',
    };
  }
}
