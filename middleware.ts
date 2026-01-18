import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_TOKEN_COOKIE, getTokenFromSearchParams } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  if (token) return NextResponse.next();

  const tokenFromQuery = getTokenFromSearchParams({
    token: searchParams.get("token") ?? undefined,
  });
  if (tokenFromQuery) {
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set(AUTH_TOKEN_COOKIE, tokenFromQuery, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 3,
    });
    return res;
  }

  if (pathname !== "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
