"use server";
import { optionalModerationOperation } from "@/lib/moderation/access";

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
  if (!(await optionalModerationOperation("checkConnection"))) return { status: "error", message: "Moderation control permission and an active secure session are required." };

  const secret = process.env.MODERATION_CONNECTION_CHECK_SECRET?.trim();
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) {
    return { status: "error", message: "Set MODERATION_CONNECTION_CHECK_SECRET on both the website server and Supabase." };
  }

  const checkedAt = londonDate.format(new Date());
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // Bound the action's wait without relying on unsupported SDK signal options.
    const { data, error } = await Promise.race([
      db.functions.invoke("moderation-openai-check", {
        method: "POST", headers: { "x-moderation-check-secret": secret },
      }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("timeout")), 12000); }),
    ]);

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
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  return { status: "error", checkedAt, message: "The Supabase check could not run. Confirm the Edge Function is deployed and both servers have the same check secret." };
}

