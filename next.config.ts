import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Disallow framing to prevent clickjacking attacks.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Prevent browsers from MIME-sniffing the content type.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Only send the origin as the referrer; avoids leaking URL paths to third parties.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Restrictive CSP. Adjust 'connect-src', 'img-src', and 'font-src' as third-party
    // integrations are added. Do NOT loosen 'script-src' without a nonce/hash strategy.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
