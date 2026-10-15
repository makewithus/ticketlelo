const PRODUCTION_URL = "https://ticketlelo.in";

export function getAppBaseUrl() {
  if (process.env.VERCEL_ENV === "preview") {
    return process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : PRODUCTION_URL;
  }

  if (process.env.NODE_ENV === "production") return PRODUCTION_URL;
  return "http://localhost:3000";
}
