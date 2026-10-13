import type { NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export const config = {
  matcher: [
    "/login",
    "/setup",
    "/activate",
    "/forgot-password",
    "/reset-password",
    "/app/:path*",
  ],
};
