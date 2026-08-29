import { Injectable, Inject } from '@nestjs/common';
import { Readable } from 'stream';
import {
  type StorageProvider,
  STORAGE_PROVIDER,
  StorageUploadInput,
  StorageUploadResult,
} from './storage.interface';

@Injectable()
export class StorageService implements StorageProvider {
  constructor(
    @Inject(STORAGE_PROVIDER)
    private readonly provider: StorageProvider,
  ) {}

  upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    return this.provider.upload(input);
  }

  getFile(storagePath: string): Promise<Buffer> {
    return this.provider.getFile(storagePath);
  }

  getDownloadStream(storagePath: string): Promise<Readable> {
    return this.provider.getDownloadStream(storagePath);
  }

  delete(storagePath: string): Promise<void> {
    return this.provider.delete(storagePath);
  }

  exists(storagePath: string): Promise<boolean> {
    return this.provider.exists(storagePath);
  }

  getSignedUrl(storagePath: string, expiresInSeconds?: number): Promise<string> {
    return this.provider.getSignedUrl(storagePath, expiresInSeconds);
  }
}
