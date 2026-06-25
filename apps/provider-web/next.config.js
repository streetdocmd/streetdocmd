/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@streetdocmd/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

module.exports = nextConfig;