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
    // Restrictive CSP. 'unsafe-inline' and 'unsafe-eval' for script-src are required
    // by Next.js's built-in CSS-in-JS and HMR mechanism. A nonce- or hash-based
    // strategy should replace these directives once the app adopts a custom Document
    // that threads nonces through to inline scripts. Adjust 'connect-src', 'img-src',
    // and 'font-src' as third-party integrations are added.
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
