import { NextRequest, NextResponse } from "next/server";

import { LOCALE_COOKIE } from "@/app/i18n/locale";
import { contentSecurityPolicy } from "@/lib/csp";
import { localeInPath, resolveLocale } from "@/lib/resolveLocale";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Speed Insights posts to a per-project random prefix Vercel injects at build;
  // it has to reach Vercel untouched, not be sent to a locale.
  const observability = process.env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH;
  if (observability && pathname.startsWith(`${observability}/`)) return NextResponse.next();

  const locale = localeInPath(pathname);

  // Every page lives under a locale; anything else is sent to the visitor's.
  if (!locale) {
    const target = resolveLocale(
      request.nextUrl.searchParams.get("lang"),
      request.cookies.get(LOCALE_COOKIE)?.value ?? null,
      request.headers.get("accept-language"),
    );
    const url = request.nextUrl.clone();
    url.pathname = `/${target}${pathname === "/" ? "" : pathname}`;
    url.searchParams.delete("lang");
    return NextResponse.redirect(url);
  }

  // Next reads the nonce from the request CSP and adds it to its scripts.
  const csp = contentSecurityPolicy(Buffer.from(crypto.randomUUID()).toString("base64"));
  request.headers.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: request.headers } });
  response.headers.set("Content-Security-Policy", csp);

  // Remembers the language for the next visit to "/".
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }

  return response;
}

// Everything but these, which next.config.ts gives the static CSP instead:
// one CSP header per response, never two.
export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/|_vercel/|icon\.svg|robots\.txt|sitemap\.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
