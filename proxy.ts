import { auth } from "@/auth";
import { NextResponse } from "next/server";

// /api/auth/* MUST be public — the OAuth callback sets the session cookie
// here, so intercepting it before the cookie is written causes a redirect loop.
const PUBLIC_PATHS = ["/login", "/demo", "/api/auth"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (req.auth) return NextResponse.next();
  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)" ],
};
