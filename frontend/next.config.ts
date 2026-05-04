import { fileURLToPath } from "node:url";
import path from "node:path";
import type { NextConfig } from "next";

// next.config.ts is loaded as ESM; __dirname doesn't exist here.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the file-tracing root to the frontend/ directory so Next.js
  // doesn't walk up to /Users/kimnahyun/ and lock onto an unrelated
  // package.json/lockfile (which broke tailwindcss resolution).
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
