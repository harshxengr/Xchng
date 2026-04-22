import { NextRequest, NextResponse } from "next/server";

function getCallbackUrl(request: NextRequest) {
  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return callbackUrl === "/" ? "/markets" : callbackUrl;
}

export function proxy(request: NextRequest) {
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", getCallbackUrl(request));
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/markets/:path*", "/ops/:path*", "/settings/:path*", "/profile/:path*", "/trade/:path*"],
};
