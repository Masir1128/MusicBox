import type { NextConfig } from "next";

const isStaticExport = process.env.ORBITONE_STATIC_EXPORT === "1";
const basePath = isStaticExport ? process.env.NEXT_PUBLIC_BASE_PATH ?? "" : "";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: isStaticExport,
  typescript: {
    tsconfigPath: isStaticExport ? "tsconfig.pages.json" : "tsconfig.json",
  },
};

export default nextConfig;
