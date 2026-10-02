import type { NextConfig } from "next";

// Two build targets from one codebase:
//  - default:         self-hosted Next.js server + SQLite (Docker, Railway, Render)
//  - SIEGEL_STATIC=1: static export for GitHub Pages; data lives in the browser (IndexedDB)
const isStatic = process.env.SIEGEL_STATIC === "1";
const basePath = process.env.SIEGEL_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: isStatic ? "export" : "standalone",
  basePath: basePath || undefined,
  trailingSlash: true,
  // Webhook senders (Stripe) don't follow redirects, so never 308 an /api URL.
  skipTrailingSlashRedirect: !isStatic,
  // In the static build only *.tsx files are routes, so the API route handlers
  // (route.ts) and the server-only code they import are left out entirely.
  pageExtensions: isStatic ? ["tsx"] : ["tsx", "ts"],
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_SIEGEL_MODE: isStatic ? "local" : "server",
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_ORIGIN: process.env.SIEGEL_SITE_ORIGIN || process.env.SIEGEL_PUBLIC_URL || "http://localhost:3000",
  },
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
};

export default nextConfig;
