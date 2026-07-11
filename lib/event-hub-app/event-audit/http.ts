import { NextResponse } from "next/server";

import { authErrorResponse } from "./auth";

export function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag": "noindex, noarchive",
    },
  });
}

export function eventAuditApiError(error: unknown) {
  const response = authErrorResponse(error);
  return noStoreJson(response.body, response.status);
}
