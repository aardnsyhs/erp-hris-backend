import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';

describe('LocalDiskStorageProvider', () => {
  let provider: LocalDiskStorageProvider;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'hris-storage-test-'),
    );
    provider = new LocalDiskStorageProvider(tempDir);
  });

  afterAll(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('upload() and getFile()', () => {
    it('should upload a buffer and retrieve it correctly', async () => {
      const buffer = Buffer.from('Hello HRIS Storage Test');
      const result = await provider.upload({
        buffer,
        filename: 'test-doc.pdf',
        mimeType: 'application/pdf',
        destinationDirectory: 'contracts',
      });

      expect(result.storagePath).toMatch(/^contracts\/.+-test-doc\.pdf$/);
      expect(result.fileSizeBytes).toBe(buffer.length);
      expect(result.mimeType).toBe('application/pdf');

      const retrieved = await provider.getFile(result.storagePath);
      expect(retrieved.toString()).toBe('Hello HRIS Storage Test');
    });

    it('should support custom storage paths', async () => {
      const buffer = Buffer.from('Custom Path Content');
      const result = await provider.upload({
        buffer,
        filename: 'ktp.jpg',
        mimeType: 'image/jpeg',
        customStoragePath: 'employees/emp-1/ktp.jpg',
      });

      expect(result.storagePath).toBe('employees/emp-1/ktp.jpg');
      const retrieved = await provider.getFile('employees/emp-1/ktp.jpg');
      expect(retrieved.toString()).toBe('Custom Path Content');
    });
  });

  describe('getDownloadStream()', () => {
    it('should stream file contents', async () => {
      const buffer = Buffer.from('Stream test data');
      const upload = await provider.upload({
        buffer,
        filename: 'stream.txt',
        mimeType: 'text/plain',
      });

      const stream = await provider.getDownloadStream(upload.storagePath);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('end', () => resolve());
        stream.on('error', (err) => reject(err));
      });

      const result = Buffer.concat(chunks).toString();
      expect(result).toBe('Stream test data');
    });
  });

  describe('exists() and delete()', () => {
    it('should check existence and delete file idempotently', async () => {
      const buffer = Buffer.from('To be deleted');
      const upload = await provider.upload({
        buffer,
        filename: 'delete-me.txt',
        mimeType: 'text/plain',
      });

      expect(await provider.exists(upload.storagePath)).toBe(true);

      await provider.delete(upload.storagePath);
      expect(await provider.exists(upload.storagePath)).toBe(false);

      // Deleting already deleted file should not throw (idempotent)
      await expect(provider.delete(upload.storagePath)).resolves.not.toThrow();
    });

    it('should throw NotFoundException on getFile for missing file', async () => {
      await expect(provider.getFile('non-existent.txt')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('path traversal security', () => {
    it('should reject paths with ../ going outside baseDir', async () => {
      await expect(provider.getFile('../../../etc/passwd')).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        provider.getFile('folder/../../outside.txt'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject paths with null bytes', async () => {
      await expect(provider.getFile('file.txt\0.jpg')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getSignedUrl()', () => {
    it('should return a signed url string for local development', async () => {
      const url = await provider.getSignedUrl('documents/doc-1.pdf', 1800);
      expect(url).toContain('/api/v1/storage/private/');
      expect(url).toContain('token=');
      expect(url).toContain('expires=');
    });
  });
});
