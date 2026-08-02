import type { NextConfig } from "next";

const developmentEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self' 'unsafe-inline'${developmentEval} https://www.paypal.com https://www.paypalobjects.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.paypal.com https://*.paypalobjects.com; connect-src 'self' https://*.paypal.com; frame-src https://*.paypal.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' https://*.paypal.com; frame-ancestors 'none'; upgrade-insecure-requests` },
    ] }];
  },
};

export default nextConfig;
