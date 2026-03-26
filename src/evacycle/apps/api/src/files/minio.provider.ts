import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';

export const MINIO_CLIENT = 'MINIO_CLIENT';

export const minioProvider: Provider = {
  provide: MINIO_CLIENT,
  useFactory: (config: ConfigService): MinioClient => {
    return new MinioClient({
      endPoint: config.get<string>('minio.endpoint', 'localhost'),
      port: config.get<number>('minio.port', 9000),
      useSSL: config.get<boolean>('minio.useSSL', false),
      accessKey: config.get<string>('minio.accessKey', 'minioadmin'),
      secretKey: config.get<string>('minio.secretKey', 'minioadmin'),
    });
  },
  inject: [ConfigService],
};
