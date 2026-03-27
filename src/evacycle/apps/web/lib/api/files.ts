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
  filename: string,
  contentType: string,
): Promise<PresignedUrlResponse> {
  const { data } = await apiClient.post<PresignedUrlResponse>(
    `/cases/${caseId}/files/presign`,
    { filename, contentType },
  );
  return data;
}

/** Step 2: MinIO PUT 업로드 */
export async function uploadToMinIO(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  await axios.put(uploadUrl, file, {
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
