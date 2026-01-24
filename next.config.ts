import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'development'
              ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live; object-src 'none'; base-uri 'self';"
              : "script-src 'self' 'unsafe-inline' https://vercel.live; object-src 'none'; base-uri 'self';"
          },
        ],
      },
    ];
  },
};

export default nextConfig;
