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
  const fileType = file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT';
  const { data } = await apiClient.post<PresignedUrlResponse>(
    `/cases/${caseId}/files/presign`,
    { fileName: file.name, fileType, contentType: file.type },
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

/** Step 3: 업로드 확인 */
export async function confirmFile(
  caseId: string,
  body: ConfirmFileBody,
): Promise<{ id: string; filename: string }> {
  const { data } = await apiClient.post(
    `/cases/${caseId}/files/confirm`,
    body,
  );
  return data;
}
