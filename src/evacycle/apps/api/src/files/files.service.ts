import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
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
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(MINIO_CLIENT) private readonly minio: MinioClient,
  ) {
    this.bucketName = this.config.get<string>('minio.bucketName', 'evacycle');
    this.publicUrl = this.config.get<string>('minio.publicUrl', 'http://localhost:9000');
  }

  async onModuleInit() {
    const exists = await this.minio.bucketExists(this.bucketName);
    if (!exists) {
      await this.minio.makeBucket(this.bucketName);
    }
  }

  async presign(caseId: string, dto: PresignFileDto, uploadedBy: string) {
    // Case 존재 확인
    const vehicleCase = await this.prisma.vehicleCase.findUnique({
      where: { id: caseId },
    });
    if (!vehicleCase) {
      throw new NotFoundException('Case not found');
    }

    // MIME 타입 검증
    const rules = FILE_TYPE_RULES[dto.fileType];
    if (rules && !rules.allowedContentTypes.includes(dto.contentType)) {
      throw new BadRequestException(
        `Content type '${dto.contentType}' is not allowed for file type ${dto.fileType}. Allowed: ${rules.allowedContentTypes.join(', ')}`,
      );
    }

    // 파일 확장자 추출
    const ext = dto.fileName.split('.').pop() ?? 'bin';

    // CaseFile 레코드 생성 (PENDING)
    const caseFile = await this.prisma.caseFile.create({
      data: {
        caseId,
        eventId: dto.eventId ?? null,
        fileName: dto.fileName,
        fileType: dto.fileType,
        contentType: dto.contentType,
        objectKey: '', // placeholder, 아래에서 업데이트
        uploadedBy,
        status: FileStatus.PENDING,
      },
    });

    const objectKey = `cases/${caseId}/files/${caseFile.id}.${ext}`;

    // objectKey 업데이트
    await this.prisma.caseFile.update({
      where: { id: caseFile.id },
      data: { objectKey },
    });

    // MinIO presigned PUT URL 발급
    let uploadUrl = await this.minio.presignedPutObject(
      this.bucketName,
      objectKey,
      PRESIGN_EXPIRY,
    );
    // 내부 MinIO 주소를 외부 접근 가능한 PUBLIC URL로 교체
    uploadUrl = uploadUrl.replace(/^https?:\/\/[^/]+/, this.publicUrl);

    return {
      fileId: caseFile.id,
      uploadUrl,
      objectKey,
      expiresIn: PRESIGN_EXPIRY,
    };
  }

  async confirmUpload(caseId: string, fileId: string, userId: string) {
    const caseFile = await this.prisma.caseFile.findFirst({
      where: { id: fileId, caseId },
    });

    if (!caseFile) {
      throw new NotFoundException('File not found');
    }

    if (caseFile.uploadedBy !== userId) {
      throw new ForbiddenException('Only the uploader can confirm this file');
    }

    if (caseFile.status !== FileStatus.PENDING) {
      throw new NotFoundException('File is not in PENDING status');
    }

    // MinIO에서 실제 업로드 확인
    const stat = await this.minio.statObject(this.bucketName, caseFile.objectKey);

    // 파일 크기 검증
    const rules = FILE_TYPE_RULES[caseFile.fileType];
    if (rules && stat.size > rules.maxSize) {
      // 초과 파일 삭제
      await this.minio.removeObject(this.bucketName, caseFile.objectKey);
      await this.prisma.caseFile.update({
        where: { id: fileId },
        data: { status: FileStatus.DELETED },
      });
      throw new BadRequestException(
        `File size ${stat.size} exceeds maximum ${rules.maxSize} bytes for type ${caseFile.fileType}`,
      );
    }

    const updated = await this.prisma.caseFile.update({
      where: { id: fileId },
      data: {
        status: FileStatus.CONFIRMED,
        fileSize: stat.size,
        uploadedAt: new Date(),
      },
    });

    return updated;
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
          downloadUrl = await this.getPresignedDownloadUrl(f.objectKey);
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
