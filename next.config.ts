import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite(WASM) / pg 는 번들링하지 않고 런타임에 require (서버리스 함수 호환)
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
