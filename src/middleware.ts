import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // ─── API Protection ───
  if (pathname.startsWith("/api/v1/admin")) {
    if (!token) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }
    if (token.role !== "ADMIN") {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "غير مصرح" },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // ─── Page Protection ───
  if (pathname.startsWith("/admin")) {
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/v1/admin/:path*"],
};
