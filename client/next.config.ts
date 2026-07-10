import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(login|register|api/auth/:path*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/business/:path*",
        destination: "/organization/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
