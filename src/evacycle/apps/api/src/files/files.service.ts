import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { FileStatus, FileType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MINIO_CLIENT } from './minio.provider';
import { PresignFileDto } from './dto/presign-file.dto';

const PRESIGN_EXPIRY = 3600; // 1 hour

const FILE_TYPE_RULES: Record<string, { allowedContentTypes: string[]; maxSize: number }> = {
  [FileType.IMAGE]: {
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  [FileType.DOCUMENT]: {
    allowedContentTypes: ['application/pdf'],
    maxSize: 20 * 1024 * 1024, // 20MB
  },
};

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private readonly bucketName: string;
  /** 브라우저가 MinIO에 접근하는 공개 URL (CORS 프록시 기준) */
  private readonly minioPublicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(MINIO_CLIENT) private readonly minio: MinioClient,
  ) {
    this.bucketName = this.config.get<string>('minio.bucketName', 'evacycle');
    const endpoint = this.config.get<string>('minio.endpoint', 'localhost');
    const port = this.config.get<number>('minio.port', 9000);
    const useSSL = this.config.get<boolean>('minio.useSSL', false);
    const proto = useSSL ? 'https' : 'http';
    // MINIO_PUBLIC_URL 설정 시 우선 사용 (프로덕션 CDN/프록시 URL)
    this.minioPublicUrl = this.config.get<string>(
      'minio.publicUrl',
      `${proto}://${endpoint}:${port}`,
    );
  }

  async onModuleInit() {
    try {
      const exists = await this.minio.bucketExists(this.bucketName);
      if (!exists) {
        await this.minio.makeBucket(this.bucketName);
        this.logger.log(`MinIO bucket '${this.bucketName}' created`);
      }
    } catch (err) {
      // MinIO 미연결 시 서버 시작 실패 방지 — 경고만 출력
      this.logger.warn(`MinIO 초기화 실패 (업로드 기능 비활성): ${(err as Error).message}`);
    }
  }

  // ─── Step 1: Presigned URL 발급 ───────────────────────────────────────────

  async presign(caseId: string, dto: PresignFileDto, uploadedBy: string) {
    // Case 존재 확인
    const vehicleCase = await this.prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });
    if (!vehicleCase) {
      throw new NotFoundException(`Case '${caseId}' not found`);
    }

    // MIME 타입 검증
    const rules = FILE_TYPE_RULES[dto.fileType];
    if (rules && !rules.allowedContentTypes.includes(dto.contentType)) {
      throw new BadRequestException(
        `Content-Type '${dto.contentType}'은 ${dto.fileType} 파일 유형에 허용되지 않습니다. ` +
        `허용: ${rules.allowedContentTypes.join(', ')}`,
      );
    }

    // 파일명 특수문자 제거
    const safeName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = safeName.split('.').pop() ?? 'bin';

    // CaseFile 레코드 생성 (PENDING)
    let caseFile: Awaited<ReturnType<typeof this.prisma.caseFile.create>>;
    try {
      caseFile = await this.prisma.caseFile.create({
        data: {
          caseId,
          eventId: dto.eventId ?? null,
          fileName: dto.fileName,
          fileType: dto.fileType,
          contentType: dto.contentType,
          objectKey: '',
          uploadedBy,
          status: FileStatus.PENDING,
        },
      });
    } catch (err) {
      this.logger.error(`CaseFile 레코드 생성 실패 (caseId=${caseId}):`, err);
      throw new InternalServerErrorException('파일 정보 저장에 실패했습니다. 잠시 후 재시도해주세요.');
    }

    const objectKey = `cases/${caseId}/files/${caseFile.id}.${ext}`;
    await this.prisma.caseFile.update({ where: { id: caseFile.id }, data: { objectKey } });

    // MinIO presigned PUT URL 발급
    let uploadUrl: string;
    try {
      uploadUrl = await this.minio.presignedPutObject(
        this.bucketName,
        objectKey,
        PRESIGN_EXPIRY,
      );
    } catch (err) {
      // Presign 실패 → PENDING 레코드 롤백
      await this.prisma.caseFile.update({
        where: { id: caseFile.id },
        data: { status: FileStatus.DELETED },
      }).catch(() => {});
      this.logger.error(`MinIO presign 실패 (objectKey=${objectKey}):`, err);
      throw new InternalServerErrorException(
        'Presigned URL 발급에 실패했습니다. MinIO 연결 상태를 확인해주세요.',
      );
    }

    // COD-20: 다운로드 URL도 public URL 기준으로 반환 (CORS 안전)
    return {
      fileId: caseFile.id,
      uploadUrl,
      objectKey,
      expiresIn: PRESIGN_EXPIRY,
    };
  }

  // ─── Step 3: 업로드 완료 확인 ──────────────────────────────────────────────

  async confirmUpload(caseId: string, fileId: string, userId: string) {
    const caseFile = await this.prisma.caseFile.findFirst({
      where: { id: fileId, caseId },
    });

    if (!caseFile) {
      throw new NotFoundException(`파일을 찾을 수 없습니다 (fileId=${fileId})`);
    }

    if (caseFile.uploadedBy !== userId) {
      throw new ForbiddenException('파일을 업로드한 사용자만 확인할 수 있습니다.');
    }

    if (caseFile.status === FileStatus.CONFIRMED) {
      // 멱등성 보장 (재시도 안전)
      this.logger.warn(`파일 이미 확인됨 (fileId=${fileId}) — 재시도로 간주`);
      return caseFile;
    }

    if (caseFile.status === FileStatus.DELETED) {
      throw new ConflictException('삭제된 파일은 확인할 수 없습니다.');
    }

    if (caseFile.status !== FileStatus.PENDING) {
      throw new ConflictException(`파일 상태가 PENDING이 아닙니다 (현재: ${caseFile.status})`);
    }

    // MinIO 실제 업로드 확인
    let stat: Awaited<ReturnType<MinioClient['statObject']>>;
    try {
      stat = await this.minio.statObject(this.bucketName, caseFile.objectKey);
    } catch (err: any) {
      const isNotFound = err?.code === 'NotFound' || err?.message?.includes('Not Found');
      this.logger.warn(`MinIO statObject 실패 (objectKey=${caseFile.objectKey}): ${err?.message}`);

      if (isNotFound) {
        throw new BadRequestException(
          '파일이 MinIO에 존재하지 않습니다. 파일 업로드가 완료되지 않았을 수 있습니다.',
        );
      }
      throw new InternalServerErrorException(
        '파일 확인 중 오류가 발생했습니다. 잠시 후 재시도해주세요.',
      );
    }

    // 파일 크기 검증
    const rules = FILE_TYPE_RULES[caseFile.fileType];
    if (rules && stat.size > rules.maxSize) {
      await Promise.allSettled([
        this.minio.removeObject(this.bucketName, caseFile.objectKey),
        this.prisma.caseFile.update({
          where: { id: fileId },
          data: { status: FileStatus.DELETED },
        }),
      ]);
      throw new BadRequestException(
        `파일 크기(${(stat.size / 1024 / 1024).toFixed(1)}MB)가 ` +
        `${caseFile.fileType} 최대 허용 크기(${rules.maxSize / 1024 / 1024}MB)를 초과합니다.`,
      );
    }

    try {
      const updated = await this.prisma.caseFile.update({
        where: { id: fileId },
        data: {
          status: FileStatus.CONFIRMED,
          fileSize: stat.size,
          uploadedAt: new Date(),
        },
      });
      return updated;
    } catch (err) {
      this.logger.error(`파일 CONFIRMED 업데이트 실패 (fileId=${fileId}):`, err);
      throw new InternalServerErrorException('파일 상태 업데이트에 실패했습니다.');
    }
  }

  async listFiles(caseId: string) {
    const files = await this.prisma.caseFile.findMany({
      where: { caseId, status: { not: FileStatus.DELETED } },
      include: {
        uploader: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const filesWithUrls = await Promise.all(
      files.map(async (f) => {
        let downloadUrl: string | null = null;
        if (f.status === FileStatus.CONFIRMED) {
          try {
            const rawUrl = await this.getPresignedDownloadUrl(f.objectKey);
            // COD-20: 내부 MinIO URL → public URL로 치환 (CORS 안전)
            downloadUrl = rawUrl.replace(
              /https?:\/\/[^/]+(?::\d+)?(?=\/)/,
              this.minioPublicUrl,
            );
          } catch {
            downloadUrl = null;
          }
        }
        return {
          id: f.id,
          fileName: f.fileName,
          fileType: f.fileType,
          fileSize: f.fileSize,
          status: f.status,
          downloadUrl,
          uploadedBy: f.uploader,
          uploadedAt: f.uploadedAt,
        };
      }),
    );

    return { files: filesWithUrls };
  }

  async deleteFile(caseId: string, fileId: string, userId: string, userRole: string) {
    const caseFile = await this.prisma.caseFile.findFirst({
      where: { id: fileId, caseId },
    });
    if (!caseFile) {
      throw new NotFoundException('File not found');
    }
    if (caseFile.uploadedBy !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Only the uploader or ADMIN can delete this file');
    }
    return this.prisma.caseFile.update({
      where: { id: fileId },
      data: { status: FileStatus.DELETED },
    });
  }

  async getPresignedDownloadUrl(objectKey: string): Promise<string> {
    return this.minio.presignedGetObject(this.bucketName, objectKey, PRESIGN_EXPIRY);
  }
}
