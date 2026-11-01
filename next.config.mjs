/** @type {import('next').NextConfig} */
const nextConfig = {
  /*
   * Keep canonical folder-style URLs so direct links such as
   * /login, /host-event, and dashboard routes resolve
   * consistently behind static CDNs and reverse proxies.
   */
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/organiser-login",
        destination: "/login/",
        permanent: true,
      },
      {
        source: "/organiser-login/:path*",
        destination: "/login/",
        permanent: true,
      },
      {
        source: "/user-login",
        destination: "/login/",
        permanent: true,
      },
      {
        source: "/user-login/:path*",
        destination: "/login/",
        permanent: true,
      },
      {
        source: "/super-admin-login",
        destination: "/login/",
        permanent: true,
      },
      {
        source: "/super-admin-login/:path*",
        destination: "/login/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
