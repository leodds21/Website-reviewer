import { NextRequest, NextResponse } from "next/server";

import { LOCALE_COOKIE } from "@/app/i18n/translations";
import { resolveLocale } from "@/lib/resolveLocale";

export function proxy(request: NextRequest) {
  const locale = resolveLocale(
    request.nextUrl.searchParams.get("lang"),
    request.cookies.get(LOCALE_COOKIE)?.value ?? null,
    request.headers.get("accept-language"),
  );

  // Writing only to the outgoing response cookie would tell the browser to
  // send it back on the *next* request — one visit too late for a single
  // click coming in with ?lang=. Setting it on the request's own cookie
  // jar rewrites the request's Cookie header in place (RequestCookies.set
  // mutates the same Headers object request.headers points at), so
  // layout.tsx's cookies() sees the resolved locale on this same request.
  request.cookies.set(LOCALE_COOKIE, locale);

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // This one is what actually reaches the browser as Set-Cookie, so the
  // resolved locale survives future visits without ?lang= too.
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
}

export const config = {
  matcher: "/",
};
