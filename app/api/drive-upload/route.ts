import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const scriptUrl = process.env.NEXT_PUBLIC_DRIVE_UPLOAD_URL;
    if (!scriptUrl) {
      return NextResponse.json(
        { ok: false, error: "Missing NEXT_PUBLIC_DRIVE_UPLOAD_URL" },
        { status: 500 }
      );
    }

    const body = await req.json();

    // Forward JSON to Apps Script from the server (no CORS)
    const upstream = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();

    // Apps Script usually returns JSON, but we safely parse
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: false, error: "Non-JSON response from upload script", raw: text };
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Upload proxy failed" },
      { status: 500 }
    );
  }
}
