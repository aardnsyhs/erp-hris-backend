import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'stream';
import { StreamableFile } from '@nestjs/common';
import { DocumentType, UserRole } from '@prisma/client';
import { EmployeeDocumentController } from './employee-document.controller';
import { EmployeeDocumentService } from './employee-document.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

describe('EmployeeDocumentController', () => {
  let controller: EmployeeDocumentController;
  let service: EmployeeDocumentService;

  const mockService = {
    upload: jest.fn(),
    findMany: jest.fn(),
    findById: jest.fn(),
    download: jest.fn(),
    remove: jest.fn(),
  };

  const hrAdminUser: AuthenticatedUser = {
    userId: 'user-admin',
    email: 'admin@example.com',
    role: UserRole.HR_ADMIN,
    employeeId: 'emp-admin',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeDocumentController],
      providers: [
        {
          provide: EmployeeDocumentService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<EmployeeDocumentController>(
      EmployeeDocumentController,
    );
    service = module.get<EmployeeDocumentService>(EmployeeDocumentService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload()', () => {
    it('should delegate to service.upload', async () => {
      const dto = {
        documentType: DocumentType.KTP,
        title: 'KTP John',
      };
      const mockFile = { buffer: Buffer.from('test') } as any;
      mockService.upload.mockResolvedValue({ id: 'doc-1', ...dto });

      const result = await controller.upload(
        'emp-1',
        dto,
        mockFile,
        hrAdminUser,
      );
      expect(mockService.upload).toHaveBeenCalledWith(
        'emp-1',
        dto,
        mockFile,
        hrAdminUser,
      );
      expect(result.id).toBe('doc-1');
    });
  });

  describe('findMany()', () => {
    it('should delegate to service.findMany', async () => {
      mockService.findMany.mockResolvedValue({ data: [], meta: {} });

      const result = await controller.findMany('emp-1', {}, hrAdminUser);
      expect(mockService.findMany).toHaveBeenCalledWith(
        'emp-1',
        {},
        hrAdminUser,
      );
      expect(result).toEqual({ data: [], meta: {} });
    });
  });

  describe('findById()', () => {
    it('should delegate to service.findById', async () => {
      mockService.findById.mockResolvedValue({ id: 'doc-1' });

      const result = await controller.findById('emp-1', 'doc-1', hrAdminUser);
      expect(mockService.findById).toHaveBeenCalledWith(
        'emp-1',
        'doc-1',
        hrAdminUser,
      );
      expect(result.id).toBe('doc-1');
    });
  });

  describe('download()', () => {
    it('should stream file and set response headers', async () => {
      const mockRes = {
        set: jest.fn(),
      } as any;

      mockService.download.mockResolvedValue({
        stream: new Readable(),
        fileName: 'ktp_john.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 10240,
      });

      const result = await controller.download(
        'emp-1',
        'doc-1',
        hrAdminUser,
        mockRes,
      );

      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="ktp_john.pdf"',
        'Content-Length': '10240',
      });
      expect(result).toBeInstanceOf(StreamableFile);
    });
  });

  describe('remove()', () => {
    it('should delegate to service.remove', async () => {
      mockService.remove.mockResolvedValue({
        message: 'Dokumen berhasil dihapus',
      });

      const result = await controller.remove('emp-1', 'doc-1', hrAdminUser);
      expect(mockService.remove).toHaveBeenCalledWith(
        'emp-1',
        'doc-1',
        hrAdminUser,
      );
      expect(result.message).toBe('Dokumen berhasil dihapus');
    });
  });
});
