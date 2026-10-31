/** @type {import('next').NextConfig} */
const nextConfig = {
  // The partner portals are served on provider.streetdocmd.com too (see
  // provider-web/next.config.js). Their scripts need a path of their own, or
  // that app would answer /_next requests with its own files.
  assetPrefix: "/partner-assets",
  async rewrites() {
    return { beforeFiles: [{ source: "/partner-assets/_next/:path+", destination: "/_next/:path+" }] };
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

module.exports = nextConfig;
