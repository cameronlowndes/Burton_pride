// A bounded Supabase Edge invocation, scheduled by pg_cron. No permanent process is simulated.
import {
  classify,
  validPolicy,
  type Decision,
  type Platform,
} from "../_shared/moderation";
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};
const env = (name: string) => Deno.env.get(name) || "";
const url = env("SUPABASE_URL");
const key = env("SUPABASE_SERVICE_ROLE_KEY");
async function db(path: string, body?: unknown, method = "POST") {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok)
    throw new Error(`Database operation failed (${response.status})`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const rpc = (name: string, args: unknown) => db(`rpc/moderation_${name}`, args);
async function sha256(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function config(platform: Platform) {
  return {
    id: env(
      platform === "facebook"
        ? "META_FACEBOOK_PAGE_ID"
        : "META_INSTAGRAM_ACCOUNT_ID",
    ),
    token: env(
      platform === "facebook"
        ? "META_FACEBOOK_PAGE_TOKEN"
        : "META_INSTAGRAM_TOKEN",
    ),
  };
}
async function graph(
  platform: Platform,
  path: string,
  body?: Record<string, string>,
) {
  const { token } = config(platform);
  const version = env("META_GRAPH_VERSION");
  if (!/^v\d+\.\d+$/.test(version) || !token)
    throw new Error("Meta configuration is incomplete");
  const response = await fetch(
    `https://graph.facebook.com/${version}/${path}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body: body ? new URLSearchParams(body) : undefined,
      signal: AbortSignal.timeout(5000),
    },
  );
  const result = await response.json();
  if (!response.ok || result.error) {
    // Only numeric provider diagnostics; response bodies may contain tokens or personal data.
    throw new Error(
      `Meta HTTP ${response.status}, code ${Number(result.error?.code || 0)}, subcode ${Number(result.error?.error_subcode || 0)}. Check permissions, token expiry and rate limits.`,
    );
  }
  return result;
}
async function connection(platform: Platform) {
  const c = config(platform);
  if (!c.id || !c.token || !env("META_GRAPH_VERSION"))
    return {
      platform,
      status: "Disconnected",
      error: "Account ID, token or Graph API version is missing.",
    };
  try {
    const account = await graph(
      platform,
      `${encodeURIComponent(c.id)}?fields=id`,
    );
    if (account.id !== c.id)
      throw new Error("Configured account did not match Meta response");
    const subscriptions = await graph(
      platform,
      `${encodeURIComponent(c.id)}/subscribed_apps`,
    );
    const field = platform === "facebook" ? "feed" : "comments";
    if (
      !subscriptions.data?.some(
        (app: { id: string; subscribed_fields?: string[] }) =>
          app.id === env("META_APP_ID") &&
          app.subscribed_fields?.includes(field),
      )
    )
      throw new Error(
        `App is not subscribed to ${field} events for this account.`,
      );
    return { platform, status: "Connected", error: null };
  } catch (error) {
    return {
      platform,
      status: "Error",
      error: error instanceof Error ? error.message : "Connection check failed",
    };
  }
}
function reviewDecision(content: string, version: number, configuredPolicy: unknown): Decision {
  const normal = content.normalize("NFKC").toLocaleLowerCase("en-GB");
  const configured = validPolicy(configuredPolicy) ? classify(content, configuredPolicy) : null;
  const categories = new Set(configured?.categories ?? []);
  if (/\b(?:i|we)\s+(?:will|shall|am going to|are going to)\s+(?:kill|shoot|stab|attack|hurt)\b|\b(?:kill|shoot|stab|attack)\s+(?:all|every)\b/.test(normal)) {
    categories.add("threat");
  }
  if (/\b(?:kill yourself|go kill yourself|take your own life)\b/.test(normal)) {
    categories.add("abuse");
  }
  const flagged = categories.size > 0;
  return {
    decision: flagged ? "review" : "allow",
    categories: [...categories],
    policyVersion: String(version),
    reason: flagged
      ? "Possible policy breach. An authorised moderator must assess context and severity."
      : "No review signal matched. This is not a comprehensive safety assessment.",
    actionStatus: flagged ? "review" : "none",
  };
}
Deno.serve(async (request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!/^[a-f0-9]{64}$/.test(token))
    return new Response("Unauthorized", { status: 401 });
  let lease: string | null = null;
  try {
    const accepted = await rpc("accept_worker", {
      p_hash: await sha256(token),
    });
    if (accepted !== true) return new Response("Unauthorized", { status: 401 });
    lease = crypto.randomUUID();
    const state = await rpc("begin", { p_lease: lease });
    if (!state) return Response.json({ skipped: true });
    const started = Date.now();
    const [connections, policies] = await Promise.all([
      Promise.all([connection("facebook"), connection("instagram")]),
      db("moderation_policy_versions?select=version&approved_at=not.is.null&order=version.desc&limit=1", undefined, "GET"),
    ]);
    const policy = policies?.[0];
    const policyApproved = Number.isSafeInteger(policy?.version) && policy.version > 0;
    const ready = await rpc("ready", {
      p_lease: lease,
      p_generation: state.generation,
      p_connections: connections,
      p_policy_valid: policyApproved,
    });
    let processed = 0;
    if (ready && policyApproved) {
      // Stop claiming before the 55s lease expires; each job is bounded to <20s.
      while (Date.now() - started < 23000 && processed < 5) {
        const job = await rpc("claim", {
          p_lease: lease,
          p_generation: state.generation,
        });
        if (!job) break;
        try {
          if (job.account_id !== config(job.platform).id)
            throw new Error(
              "Job account no longer matches the configured account",
            );
          const decision = reviewDecision(job.content, policy.version, state.policy);
          await rpc("finish", {
            p_lease: lease,
            p_job: job.id,
            p_decision: decision,
          });
        } catch (error) {
          await rpc("finish", {
            p_lease: lease,
            p_job: job.id,
            p_error:
              error instanceof Error ? error.message : "Processing failed",
            p_retry_seconds: Math.min(3600, 60 * 2 ** job.attempts),
          });
        }
        processed++;
      }
    }
    await rpc("end", { p_lease: lease });
    lease = null;
    return Response.json({ processed, ready });
  } catch {
    // Leave a failed invocation's lease intact: the next tick records a recovery attempt.
    return Response.json(
      {
        error:
          "Worker invocation failed. Inspect database availability and Edge logs.",
      },
      { status: 503 },
    );
  }
});
