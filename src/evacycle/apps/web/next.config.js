/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
