/** @type {import('next').NextConfig} */
const nextConfig = {
  /*
   * Keep canonical folder-style URLs so direct links such as
   * /login, /host-event, and dashboard routes resolve
   * consistently behind static CDNs and reverse proxies.
   */
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "unsafe-none",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/organiser-login",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/organiser-login/:path*",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/user-login",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/user-login/:path*",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/super-admin-login",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/super-admin-login/:path*",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
