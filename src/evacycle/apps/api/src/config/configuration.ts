/**
 * 애플리케이션 환경변수 설정
 * .env 파일에서 읽어와 타입 안전하게 제공
 */
export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    env: process.env.NODE_ENV ?? 'development',
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
  },

  database: {
    url: process.env.DATABASE_URL,
    // Prisma가 DATABASE_URL을 직접 읽지만 개별 설정도 보관
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    name: process.env.DB_NAME ?? 'evacycle',
    user: process.env.DB_USER ?? 'evacycle_user',
    password: process.env.DB_PASSWORD ?? '',
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-this-in-production',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ?? 'change-refresh-secret-too',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
    // 연결 URL (선택적)
    url: process.env.REDIS_URL,
  },

  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    bucketName: process.env.MINIO_BUCKET ?? 'evacycle',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    // 브라우저가 MinIO에 접근할 때 사용하는 공개 URL
    // 개발: http://localhost:9000, 프로덕션: https://minio.example.com
    publicUrl: process.env.MINIO_PUBLIC_URL ?? undefined,
  },

  blockchain: {
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL ?? '',
    privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY ?? '',
    contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS ?? '',
    networkId: parseInt(process.env.BLOCKCHAIN_NETWORK_ID ?? '1', 10),
  },
});
