// Facilities use this domain too. Their portals, registration and APIs live in
// the admin app and are served from here, so partners never leave it.
const ADMIN_APP_URL = process.env.ADMIN_APP_URL ?? "https://admin.streetdocmd.com";
const PARTNER_PATHS = [
  "/lab-portal", "/pharmacy-portal", "/hospital-portal", "/register/facility",
  "/api/lab-portal", "/api/pharmacy-portal", "/api/hospital-portal", "/api/facility", "/api/account",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@streetdocmd/shared"],
  async rewrites() {
    return [
      ...PARTNER_PATHS.flatMap(p => [
        { source: p, destination: `${ADMIN_APP_URL}${p}` },
        { source: `${p}/:path*`, destination: `${ADMIN_APP_URL}${p}/:path*` },
      ]),
      { source: "/partner-assets/:path*", destination: `${ADMIN_APP_URL}/partner-assets/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

module.exports = nextConfig;