import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    // Bug reports and existing post attachments are uploaded through server
    // actions. Allow several screenshots in one multipart request.
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
