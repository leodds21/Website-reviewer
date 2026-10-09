import { NextRequest, NextResponse } from "next/server";

import { LOCALE_COOKIE } from "@/app/i18n/translations";
import { contentSecurityPolicy } from "@/lib/csp";
import { resolveLocale } from "@/lib/resolveLocale";

export function proxy(request: NextRequest) {
  const locale = resolveLocale(
    request.nextUrl.searchParams.get("lang"),
    request.cookies.get(LOCALE_COOKIE)?.value ?? null,
    request.headers.get("accept-language"),
  );

  // Set on the request too, so layout.tsx sees it on this same request.
  request.cookies.set(LOCALE_COOKIE, locale);

  // Next reads the nonce from the request CSP and adds it to its scripts.
  const csp = contentSecurityPolicy(Buffer.from(crypto.randomUUID()).toString("base64"));
  request.headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: request.headers },
  });
  response.headers.set("Content-Security-Policy", csp);

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
