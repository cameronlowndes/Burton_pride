"use server";

import { db, evidenceAdmin, londonDate } from "../Server/Documents/evidence";

export type OpenAICheck = { status: "success" | "error"; message: string; checkedAt?: string };

const reasons: Record<string, string> = {
  configuration: "OPENAI_API_KEY is missing in the Supabase Edge Function secrets.",
  credentials: "OpenAI rejected the API key or its permissions. Check the key in the OpenAI project and update the Supabase secret.",
  rate_limit: "OpenAI rate-limited the check. Try again later.",
  provider: "Supabase could not complete the OpenAI request. Try again or check the Edge Function logs.",
  invalid_response: "OpenAI returned a response the check could not validate.",
};

export async function checkOpenAI(): Promise<OpenAICheck> {
  if (!(await evidenceAdmin())) return { status: "error", message: "Main Admin access is required." };

  const secret = process.env.MODERATION_CONNECTION_CHECK_SECRET?.trim();
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) {
    return { status: "error", message: "Set MODERATION_CONNECTION_CHECK_SECRET on both the website server and Supabase." };
  }

  const checkedAt = londonDate.format(new Date());
  try {
    const { data, error } = await db.functions.invoke("moderation-openai-check", {
      method: "POST",
      headers: { "x-moderation-check-secret": secret },
      signal: AbortSignal.timeout(12_000),
    });

    if (!error && data?.status === "connected" && typeof data.model === "string" &&
        /^[a-zA-Z0-9._-]{1,100}$/.test(data.model)) {
      return { status: "success", checkedAt, message: `OpenAI responded successfully. Returned model: ${data.model}.` };
    }

    if (!error && data?.status === "unavailable" && typeof data.reason === "string" &&
        Object.prototype.hasOwnProperty.call(reasons, data.reason)) {
      return { status: "error", checkedAt, message: reasons[data.reason] };
    }
  } catch {
    // Only a sanitised message is returned to the browser.
  }

  return { status: "error", checkedAt, message: "The Supabase check could not run. Confirm the Edge Function is deployed and both servers have the same check secret." };
}
