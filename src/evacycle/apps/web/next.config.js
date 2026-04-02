/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  async rewrites() {
    const apiUrl = process.env.INTERNAL_API_URL || 'http://api:3000';
    const minioUrl = process.env.INTERNAL_MINIO_URL || 'http://minio:9000';
    return [
      {
        source: '/api/backend/:path*',
        destination: `${apiUrl}/v1/:path*`,
      },
      {
        source: '/api/minio/:path*',
        destination: `${minioUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
