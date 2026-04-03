import apiClient from './client';
import axios from 'axios';

export interface PresignedUrlResponse {
  uploadUrl: string;
  downloadUrl: string;
  key: string;
  fileId: string;
}

export interface ConfirmFileBody {
  fileId: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

/** Step 1: Presigned URL 요청 */
export async function presignFile(
  caseId: string,
  file: File,
): Promise<PresignedUrlResponse> {
  // 클라이언트 사이드 파일 크기 사전 검증
  const MAX_SIZES: Record<string, number> = {
    'application/pdf': 20 * 1024 * 1024, // 20MB
  };
  const defaultMaxSize = 10 * 1024 * 1024; // 이미지: 10MB
  const maxSize = MAX_SIZES[file.type] ?? defaultMaxSize;
  if (file.size > maxSize) {
    const maxMb = maxSize / 1024 / 1024;
    throw new Error(`파일 크기는 ${maxMb}MB 이하여야 합니다. (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }

  const fileType = file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT';
  const { data } = await apiClient.post<PresignedUrlResponse>(
    `/cases/${caseId}/files/presign`,
    { fileName: file.name, fileType, contentType: file.type, fileSize: file.size },
  );
  return data;
}

/** Step 2: MinIO PUT 업로드
 *  브라우저에서 MinIO(localhost:9000)로 직접 PUT 시 CORS 차단됨.
 *  Next.js rewrite `/api/minio/*` → `http://localhost:9000/*` 로 프록시 경유.
 */
export async function uploadToMinIO(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  // localhost:9000 → /api/minio 치환 (브라우저 환경에서만 적용)
  const proxyUrl =
    typeof window !== 'undefined'
      ? uploadUrl.replace(/https?:\/\/localhost:9000/, '/api/minio')
      : uploadUrl;

  await axios.put(proxyUrl, file, {
    headers: { 'Content-Type': file.type },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
}

/** 케이스 파일 목록 조회 */
export async function getCaseFiles(caseId: string): Promise<{
  files: Array<{
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number | null;
    status: string;
    downloadUrl: string | null;
    uploadedAt: string | null;
  }>;
}> {
  const { data } = await apiClient.get(`/cases/${caseId}/files`);
  return data;
}

/** Step 3: 업로드 확인
 *  백엔드: POST /cases/:id/files/:fileId/confirm (fileId는 URL 파라미터)
 *  body는 사용하지 않음 — 백엔드가 DB/MinIO에서 직접 파일 정보 읽음
 */
export async function confirmFile(
  caseId: string,
  body: ConfirmFileBody,
): Promise<{ id: string; filename: string }> {
  const { data } = await apiClient.post(
    `/cases/${caseId}/files/${body.fileId}/confirm`,
  );
  return data;
}
