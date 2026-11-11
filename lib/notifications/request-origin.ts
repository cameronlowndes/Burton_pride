import "server-only";
import type { NextRequest } from "next/server";

/** Compare the browser Origin with the actual request Host, not NextURL's
 * normalised development hostname. Do not trust caller-supplied forwarded hosts. */
export function isPortalOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (
    !origin ||
    !host ||
    !["http:", "https:"].includes(request.nextUrl.protocol)
  )
    return false;
  try {
    const actual = new URL(origin);
    const expected = new URL(`${request.nextUrl.protocol}//${host}`);
    return (
      actual.origin === origin &&
      !expected.username &&
      !expected.password &&
      expected.pathname === "/" &&
      !expected.search &&
      !expected.hash &&
      actual.origin === expected.origin
    );
  } catch {
    return false;
  }
}
