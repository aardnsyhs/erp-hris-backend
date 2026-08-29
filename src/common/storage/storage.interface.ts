import { Readable } from 'stream';

export interface StorageUploadInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  destinationDirectory?: string;
  customStoragePath?: string;
}

export interface StorageUploadResult {
  storagePath: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface StorageProvider {
  /**
   * Uploads a file buffer to storage and returns the generated storage path.
   */
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;

  /**
   * Reads a file and returns its content buffer.
   */
  getFile(storagePath: string): Promise<Buffer>;

  /**
   * Returns a readable stream for the file.
   */
  getDownloadStream(storagePath: string): Promise<Readable>;

  /**
   * Deletes a file from storage.
   */
  delete(storagePath: string): Promise<void>;

  /**
   * Checks if a file exists in storage.
   */
  exists(storagePath: string): Promise<boolean>;

  /**
   * Generates a signed URL or access token path for accessing the file.
   */
  getSignedUrl(storagePath: string, expiresInSeconds?: number): Promise<string>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
