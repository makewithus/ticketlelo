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
  const refCode =
    request.nextUrl.searchParams.get("ref") ||
    request.nextUrl.searchParams.get("referralCode");

  // If user lands on home page with an ambassador referral code, redirect to /discover to view events
  if ((cleanPath === "" || cleanPath === "/") && refCode) {
    const url = new URL(`/discover${search}`, request.url);
    const redirectRes = NextResponse.redirect(url, 307);
    redirectRes.cookies.set("ticketlelo_ref_code", refCode.trim().toUpperCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30-day attribution window
      sameSite: "lax",
    });
    redirectRes.headers.set("Cross-Origin-Opener-Policy", "unsafe-none");
    return redirectRes;
  }

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
  if (refCode) {
    response.cookies.set("ticketlelo_ref_code", refCode.trim().toUpperCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30-day attribution window
      sameSite: "lax",
    });
  }
  response.headers.set("Cross-Origin-Opener-Policy", "unsafe-none");
  return response;
}

// Configure which routes to apply middleware to
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
