import type { NextConfig } from "next";

/** Allow document uploads up to the API 1GB file cap (multipart overhead included). */
const UPLOAD_BODY_LIMIT = "1gb";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@vmp/shared"],
  experimental: {
    // Next 15 buffers request bodies for middleware / the standalone proxy (default 10MB).
    // Without this, /api/v1/documents uploads are truncated and the API aborts with ECONNRESET.
    middlewareClientMaxBodySize: UPLOAD_BODY_LIMIT,
    // Present in Next 15.5+ standalone proxy; typed loosely until the NextConfig types catch up.
    ...({ proxyClientMaxBodySize: UPLOAD_BODY_LIMIT } as object),
  },
  async rewrites() {
    const api = process.env.API_PROXY_URL ?? "http://localhost:3001";
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
};

export default nextConfig;
