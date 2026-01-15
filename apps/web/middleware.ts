import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/overview", "/buildings", "/research"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = request.cookies.get("xnova_access")?.value;
  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/overview/:path*", "/buildings/:path*", "/research/:path*"],
};
