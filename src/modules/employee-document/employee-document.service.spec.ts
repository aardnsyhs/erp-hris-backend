import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'stream';
import { DocumentType, ScanStatus, UserRole } from '@prisma/client';
import { EmployeeDocumentService } from './employee-document.service';
import { EmployeeDocumentRepository } from './employee-document.repository';
import { StorageService } from '../../common/storage/storage.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateDocumentDto } from './dto/create-document.dto';

describe('EmployeeDocumentService', () => {
  let service: EmployeeDocumentService;
  let repository: jest.Mocked<Partial<EmployeeDocumentRepository>>;
  let storageService: jest.Mocked<Partial<StorageService>>;
  let auditLogService: jest.Mocked<Partial<AuditLogService>>;

  const mockEmployee = {
    id: 'emp-1',
    nip: 'EMP001',
    fullName: 'John Doe',
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@example.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin',
  };

  const employeeUser: AuthenticatedUser = {
    userId: 'user-emp-1',
    email: 'john@example.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-1',
  };

  const otherEmployeeUser: AuthenticatedUser = {
    userId: 'user-emp-2',
    email: 'other@example.com',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp-2',
  };

  const mockDocument = {
    id: 'doc-1',
    employeeId: 'emp-1',
    documentType: DocumentType.KTP,
    title: 'KTP John Doe',
    fileName: 'ktp_john.pdf',
    storagePath: 'documents/emp-1/uuid-ktp_john.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 102400,
    scanStatus: ScanStatus.CLEAN,
    expiryDate: null,
    uploadedById: 'user-admin',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQuarantinedDocument = {
    ...mockDocument,
    id: 'doc-quarantine',
    scanStatus: ScanStatus.QUARANTINED,
  };

  const mockMulterFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'ktp john.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 102400,
    buffer: Buffer.from('dummy pdf content'),
    stream: new Readable(),
    destination: '',
    filename: '',
    path: '',
  };

  beforeEach(async () => {
    repository = {
      findEmployeeById: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
      softDelete: jest.fn(),
    };

    storageService = {
      upload: jest.fn().mockResolvedValue({
        path: 'documents/emp-1/uuid-ktp_john.pdf',
        sizeBytes: 102400,
      }),
      exists: jest.fn().mockResolvedValue(true),
      getDownloadStream: jest.fn().mockResolvedValue(new Readable()),
    };

    auditLogService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeDocumentService,
        { provide: EmployeeDocumentRepository, useValue: repository },
        { provide: StorageService, useValue: storageService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<EmployeeDocumentService>(EmployeeDocumentService);
  });

  describe('upload()', () => {
    const createDto: CreateDocumentDto = {
      documentType: DocumentType.KTP,
      title: 'KTP John Doe',
    };

    it('1. Sukses mengunggah dokumen PDF valid: file disimpan di storage, metadata dibuat, dan audit log tercatat', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.create.mockResolvedValue(mockDocument as any);

      const result = await service.upload(
        'emp-1',
        createDto,
        mockMulterFile,
        hrAdminUser,
      );

      expect(storageService.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: mockMulterFile.buffer,
          mimeType: 'application/pdf',
          destinationDirectory: 'documents/emp-1',
        }),
      );
      expect(repository.create).toHaveBeenCalled();
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPLOAD_DOCUMENT',
          entity: 'EmployeeDocument',
          entityId: mockDocument.id,
        }),
      );
      // Ensure storagePath is NEVER exposed in response DTO
      expect((result as any).storagePath).toBeUndefined();
      expect(result.id).toBe('doc-1');
      expect(result.title).toBe('KTP John Doe');
    });

    it('2. Gagal jika file kosong -> BadRequestException', async () => {
      await expect(
        service.upload('emp-1', createDto, null as any, hrAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('3. Gagal jika tipe MIME tidak diizinkan -> BadRequestException', async () => {
      const invalidFile = {
        ...mockMulterFile,
        mimetype: 'application/x-executable',
      };

      await expect(
        service.upload('emp-1', createDto, invalidFile as any, hrAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('4. Gagal jika ukuran file melebihi 10MB -> BadRequestException', async () => {
      const oversizedFile = {
        ...mockMulterFile,
        size: 11 * 1024 * 1024, // 11MB
      };

      await expect(
        service.upload('emp-1', createDto, oversizedFile as any, hrAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('5. Gagal jika employee tidak ditemukan -> NotFoundException', async () => {
      repository.findEmployeeById.mockResolvedValue(null);

      await expect(
        service.upload('emp-999', createDto, mockMulterFile, hrAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('6. Non-blocking: upload tetap berhasil jika auditLog recording gagal', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.create.mockResolvedValue(mockDocument as any);
      auditLogService.record.mockResolvedValue(null);

      const result = await service.upload(
        'emp-1',
        createDto,
        mockMulterFile,
        hrAdminUser,
      );
      expect(result.id).toBe('doc-1');
    });
  });

  describe('findMany()', () => {
    it('7. Sukses mengambil daftar dokumen oleh HR_ADMIN', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findMany.mockResolvedValue({
        data: [mockDocument as any],
        total: 1,
      });

      const result = await service.findMany('emp-1', {}, hrAdminUser);

      expect(result.data.length).toBe(1);
      expect((result.data[0] as any).storagePath).toBeUndefined();
      expect(result.meta.total).toBe(1);
    });

    it('8. Sukses mengambil daftar dokumen oleh EMPLOYEE untuk dirinya sendiri', async () => {
      repository.findEmployeeById.mockResolvedValue(mockEmployee as any);
      repository.findMany.mockResolvedValue({
        data: [mockDocument as any],
        total: 1,
      });

      const result = await service.findMany('emp-1', {}, employeeUser);

      expect(result.data.length).toBe(1);
    });

    it('9. Gagal jika EMPLOYEE mencoba mengambil dokumen karyawan lain -> ForbiddenException', async () => {
      await expect(
        service.findMany('emp-1', {}, otherEmployeeUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findById()', () => {
    it('10. Sukses mengambil detail metadata dokumen', async () => {
      repository.findById.mockResolvedValue(mockDocument as any);

      const result = await service.findById('emp-1', 'doc-1', employeeUser);

      expect(result.id).toBe('doc-1');
      expect((result as any).storagePath).toBeUndefined();
    });

    it('11. Gagal jika dokumen tidak ditemukan -> NotFoundException', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findById('emp-1', 'doc-999', employeeUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('download()', () => {
    it('12. Sukses download file dokumen: mengembalikan stream dan mencatat audit log', async () => {
      repository.findById.mockResolvedValue(mockDocument as any);

      const result = await service.download('emp-1', 'doc-1', employeeUser);

      expect(result.stream).toBeDefined();
      expect(result.fileName).toBe(mockDocument.fileName);
      expect(result.mimeType).toBe(mockDocument.mimeType);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DOWNLOAD_DOCUMENT',
          entity: 'EmployeeDocument',
          entityId: 'doc-1',
        }),
      );
    });

    it('13. Gagal download dokumen jika status QUARANTINED -> GoneException', async () => {
      repository.findById.mockResolvedValue(mockQuarantinedDocument as any);

      await expect(
        service.download('emp-1', 'doc-quarantine', employeeUser),
      ).rejects.toThrow(GoneException);
    });

    it('14. Gagal download jika file tidak ada di storage -> NotFoundException', async () => {
      repository.findById.mockResolvedValue(mockDocument as any);
      storageService.exists.mockResolvedValue(false);

      await expect(
        service.download('emp-1', 'doc-1', employeeUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('15. Sukses soft delete dokumen dan mencatat audit log', async () => {
      repository.findById.mockResolvedValue(mockDocument as any);
      repository.softDelete.mockResolvedValue(mockDocument as any);

      const result = await service.remove('emp-1', 'doc-1', hrAdminUser);

      expect(result).toEqual({ message: 'Dokumen berhasil dihapus' });
      expect(repository.softDelete).toHaveBeenCalledWith('doc-1');
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE_DOCUMENT',
          entity: 'EmployeeDocument',
          entityId: 'doc-1',
        }),
      );
    });

    it('16. Gagal jika dokumen tidak ditemukan -> NotFoundException', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.remove('emp-1', 'doc-999', hrAdminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
