import { timingSafeEqual } from "node:crypto";
import { classifyComment } from "../_shared/openai-moderation.ts";

const encoder = new TextEncoder();

function reply(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply({ status: "method_not_allowed" }, 405);

  const secret = Deno.env.get("MODERATION_CONNECTION_CHECK_SECRET")?.trim();
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) return reply({ status: "check_not_configured" }, 503);

  const presented = request.headers.get("x-moderation-check-secret") ?? "";
  if (!/^[a-f0-9]{64}$/.test(presented) ||
      !timingSafeEqual(encoder.encode(secret), encoder.encode(presented))) {
    return reply({ status: "unauthorised" }, 401);
  }

  const signal = await classifyComment(
    "This is a synthetic connection test for the moderation service.",
    Deno.env.get("OPENAI_API_KEY"),
  );

  return signal.status === "classified"
    ? reply({ status: "connected", model: signal.model })
    : reply({ status: "unavailable", reason: signal.reason });
});
