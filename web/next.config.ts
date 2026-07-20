import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // `next start` serves public/ natively — no standalone public-copy gymnastics.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
