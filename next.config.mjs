/** @type {import('next').NextConfig} */
const nextConfig = {
  /*
   * Keep canonical folder-style URLs so direct links such as
   * /organiser-login, /user-login, /host-event, and dashboard routes resolve
   * consistently behind static CDNs and reverse proxies.
   */
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
