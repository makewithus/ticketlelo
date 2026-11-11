import { NextResponse } from "next/server";

export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // Never redirect API routes, static files, or internal assets
  if (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const cleanPath = pathname.replace(/\/+$/, "");

  // Enforce single unified login: redirect all legacy login paths to /login
  if (
    cleanPath === "/organiser-login" ||
    cleanPath === "/user-login" ||
    cleanPath === "/super-admin-login" ||
    pathname.startsWith("/organiser-login") ||
    pathname.startsWith("/user-login") ||
    pathname.startsWith("/super-admin-login")
  ) {
    const url = new URL(`/login${search}`, request.url);
    return NextResponse.redirect(url, 307);
  }

  const response = NextResponse.next();
  response.headers.set("Cross-Origin-Opener-Policy", "unsafe-none");
  return response;
}

// Configure which routes to apply middleware to
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
