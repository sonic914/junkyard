import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { minioProvider } from './minio.provider';

@Module({
  controllers: [FilesController],
  providers: [minioProvider, FilesService],
  exports: [FilesService],
})
export class FilesModule {}
