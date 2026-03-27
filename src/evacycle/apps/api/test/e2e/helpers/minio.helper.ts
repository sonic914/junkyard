/**
 * MinIO Presigned URL 테스트 헬퍼
 * 실제 MinIO 없이 mock으로 presigned URL 생성/검증
 */

export interface PresignedUrlResponse {
  uploadUrl: string;
  downloadUrl: string;
  key: string;
  bucket: string;
  expiresIn: number;
}

export interface MockFileUpload {
  filename: string;
  contentType: string;
  size: number;
  key: string;
}

const MOCK_BUCKET = 'evacycle-test';
const MOCK_BASE_URL = 'http://localhost:9000';

/**
 * Mock presigned upload URL 생성
 */
export function generateMockPresignedUrl(
  caseId: string,
  filename: string,
): PresignedUrlResponse {
  const key = `cases/${caseId}/files/${Date.now()}-${filename}`;
  const token = Buffer.from(`${key}:${Date.now()}`).toString('base64');

  return {
    uploadUrl: `${MOCK_BASE_URL}/${MOCK_BUCKET}/${key}?X-Amz-Signature=${token}&X-Amz-Expires=3600`,
    downloadUrl: `${MOCK_BASE_URL}/${MOCK_BUCKET}/${key}`,
    key,
    bucket: MOCK_BUCKET,
    expiresIn: 3600,
  };
}

/**
 * Mock 파일 업로드 시뮬레이션
 * presigned URL로 PUT 요청을 보낸 것처럼 결과 반환
 */
export function simulateMockUpload(
  presigned: PresignedUrlResponse,
  filename: string,
  contentType: string,
  size: number,
): MockFileUpload {
  return {
    filename,
    contentType,
    size,
    key: presigned.key,
  };
}

/**
 * Presigned URL 형식 검증
 */
export function validatePresignedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.has('X-Amz-Signature') &&
      parsed.searchParams.has('X-Amz-Expires') &&
      parsed.pathname.includes(MOCK_BUCKET)
    );
  } catch {
    return false;
  }
}

/**
 * Mock 파일 메타데이터 생성
 */
export function createMockFileMetadata(
  caseId: string,
  files: Array<{ filename: string; contentType: string; size: number }>,
): MockFileUpload[] {
  return files.map((file) => {
    const presigned = generateMockPresignedUrl(caseId, file.filename);
    return simulateMockUpload(presigned, file.filename, file.contentType, file.size);
  });
}
