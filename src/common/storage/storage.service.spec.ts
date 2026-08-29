import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { STORAGE_PROVIDER, StorageProvider } from './storage.interface';
import { Readable } from 'stream';

describe('StorageService', () => {
  let service: StorageService;
  let mockProvider: jest.Mocked<StorageProvider>;

  beforeEach(async () => {
    mockProvider = {
      upload: jest.fn(),
      getFile: jest.fn(),
      getDownloadStream: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      getSignedUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: STORAGE_PROVIDER,
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delegate upload to provider', async () => {
    const input = {
      buffer: Buffer.from('test'),
      filename: 'file.txt',
      mimeType: 'text/plain',
    };
    const expected = {
      storagePath: 'uploads/file.txt',
      filename: 'file.txt',
      mimeType: 'text/plain',
      fileSizeBytes: 4,
    };
    mockProvider.upload.mockResolvedValue(expected);

    const result = await service.upload(input);
    expect(mockProvider.upload).toHaveBeenCalledWith(input);
    expect(result).toEqual(expected);
  });

  it('should delegate getFile to provider', async () => {
    const buffer = Buffer.from('content');
    mockProvider.getFile.mockResolvedValue(buffer);

    const result = await service.getFile('path/to/file');
    expect(mockProvider.getFile).toHaveBeenCalledWith('path/to/file');
    expect(result).toBe(buffer);
  });

  it('should delegate getDownloadStream to provider', async () => {
    const stream = new Readable();
    mockProvider.getDownloadStream.mockResolvedValue(stream);

    const result = await service.getDownloadStream('path/to/file');
    expect(mockProvider.getDownloadStream).toHaveBeenCalledWith('path/to/file');
    expect(result).toBe(stream);
  });

  it('should delegate delete to provider', async () => {
    mockProvider.delete.mockResolvedValue(undefined);

    await service.delete('path/to/file');
    expect(mockProvider.delete).toHaveBeenCalledWith('path/to/file');
  });

  it('should delegate exists to provider', async () => {
    mockProvider.exists.mockResolvedValue(true);

    const result = await service.exists('path/to/file');
    expect(mockProvider.exists).toHaveBeenCalledWith('path/to/file');
    expect(result).toBe(true);
  });

  it('should delegate getSignedUrl to provider', async () => {
    mockProvider.getSignedUrl.mockResolvedValue('https://storage.local/signed-url');

    const result = await service.getSignedUrl('path/to/file', 1200);
    expect(mockProvider.getSignedUrl).toHaveBeenCalledWith('path/to/file', 1200);
    expect(result).toBe('https://storage.local/signed-url');
  });
});
