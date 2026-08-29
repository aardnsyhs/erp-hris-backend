import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
} from '../storage.interface';

@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(
      baseDir || process.env.STORAGE_LOCAL_ROOT || './storage/private',
    );
  }

  /**
   * Sanitizes and resolves a relative storage path safely against baseDir.
   * Throws BadRequestException if path traversal is detected.
   */
  private resolveSafePath(relativePath: string): string {
    if (!relativePath || typeof relativePath !== 'string') {
      throw new BadRequestException('Invalid storage path provided');
    }

    // Check for null bytes or control characters
    if (relativePath.includes('\0')) {
      throw new BadRequestException('Path traversal detected');
    }

    const resolvedPath = path.resolve(this.baseDir, relativePath);

    // Verify resolved path stays strictly within baseDir
    const baseWithSep = this.baseDir.endsWith(path.sep)
      ? this.baseDir
      : this.baseDir + path.sep;

    if (!resolvedPath.startsWith(baseWithSep) && resolvedPath !== this.baseDir) {
      throw new BadRequestException('Path traversal detected');
    }

    return resolvedPath;
  }

  /**
   * Sanitizes a filename to prevent invalid filesystem characters.
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.+/g, '.')
      .slice(0, 255);
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const { buffer, filename, mimeType, destinationDirectory, customStoragePath } =
      input;

    const sanitizedName = this.sanitizeFilename(filename);
    let relativeStoragePath: string;

    if (customStoragePath) {
      relativeStoragePath = customStoragePath;
    } else {
      const destDir = destinationDirectory
        ? destinationDirectory.replace(/^\/+|\/+$/g, '')
        : 'uploads';
      relativeStoragePath = `${destDir}/${randomUUID()}-${sanitizedName}`;
    }

    const fullPath = this.resolveSafePath(relativeStoragePath);
    const parentDir = path.dirname(fullPath);

    await fs.promises.mkdir(parentDir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);

    return {
      storagePath: relativeStoragePath,
      filename: sanitizedName,
      mimeType,
      fileSizeBytes: buffer.length,
    };
  }

  async getFile(storagePath: string): Promise<Buffer> {
    const fullPath = this.resolveSafePath(storagePath);
    try {
      return await fs.promises.readFile(fullPath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new NotFoundException(`File not found at: ${storagePath}`);
      }
      throw err;
    }
  }

  async getDownloadStream(storagePath: string): Promise<Readable> {
    const fullPath = this.resolveSafePath(storagePath);
    try {
      await fs.promises.access(fullPath, fs.constants.R_OK);
      return fs.createReadStream(fullPath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new NotFoundException(`File not found at: ${storagePath}`);
      }
      throw err;
    }
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = this.resolveSafePath(storagePath);
    try {
      await fs.promises.unlink(fullPath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // Idempotent delete: if file already doesn't exist, treat as success
        return;
      }
      throw err;
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolveSafePath(storagePath);
      await fs.promises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(
    storagePath: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    this.resolveSafePath(storagePath);
    // For local disk provider, generate internal signed path representation
    const token = randomUUID();
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    return `/api/v1/storage/private/${encodeURIComponent(storagePath)}?token=${token}&expires=${expiresAt}`;
  }
}
