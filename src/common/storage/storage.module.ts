import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { STORAGE_PROVIDER } from './storage.interface';
import { LocalDiskStorageProvider } from './providers/local-disk-storage.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const localRoot = configService.get<string>(
          'STORAGE_LOCAL_ROOT',
          './storage/private',
        );
        return new LocalDiskStorageProvider(localRoot);
      },
    },
    StorageService,
  ],
  exports: [StorageService, STORAGE_PROVIDER],
})
export class StorageModule {}
