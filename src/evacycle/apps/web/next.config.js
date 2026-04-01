/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker standalone 빌드 (NAS 배포용)
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:3000/v1/:path*',
      },
      {
        source: '/api/minio/:path*',
        destination: 'http://localhost:9000/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
