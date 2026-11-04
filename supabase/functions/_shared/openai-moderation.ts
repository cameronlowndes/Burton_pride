const endpoint = "https://api.openai.com/v1/moderations";
export const model = "omni-moderation-latest";

export type ModerationSignal =
  | { status: "classified"; flagged: boolean; categories: string[]; model: string }
  | { status: "unavailable"; reason: "configuration" | "empty_input" | "credentials" | "rate_limit" | "provider" | "invalid_response" };

export async function classifyComment(text: string, apiKey: string | undefined): Promise<ModerationSignal> {
  if (!apiKey?.trim()) return { status: "unavailable", reason: "configuration" };
  if (!text.trim()) return { status: "unavailable", reason: "empty_input" };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: text }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { status: "unavailable", reason: "provider" };
  }

  if (response.status === 401 || response.status === 403) return { status: "unavailable", reason: "credentials" };
  if (response.status === 429) return { status: "unavailable", reason: "rate_limit" };
  if (!response.ok) return { status: "unavailable", reason: "provider" };

  const payload = await response.json().catch(() => null);
  const result = payload?.results?.[0];
  if (typeof payload?.model !== "string" || typeof result?.flagged !== "boolean" ||
      !result.categories || typeof result.categories !== "object" || Array.isArray(result.categories) ||
      Object.values(result.categories).some(value => typeof value !== "boolean")) {
    return { status: "unavailable", reason: "invalid_response" };
  }
  return {
    status: "classified",
    flagged: result.flagged,
    categories: Object.entries(result.categories).filter(([, active]) => active === true).map(([name]) => name),
    model: payload.model,
  };
}
