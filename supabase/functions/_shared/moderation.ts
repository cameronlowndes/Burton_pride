/** Shared, deterministic policy engine. Meta tokens and admin credentials never enter this module. */
export type Platform = "facebook" | "instagram";
export type Policy = {
  approved: boolean;
  version: string;
  rules: {
    category: "hate" | "harassment" | "threat" | "spam" | "abuse";
    phrase: string;
    action: "hide" | "review";
  }[];
};
export type Decision = {
  decision: "allow" | "review" | "hide";
  categories: string[];
  policyVersion: string;
  reason: string;
  actionStatus: "none" | "review" | "applied";
};
export type Event = {
  platform: Platform;
  account_id: string;
  comment_id: string;
  content: string;
};
export function validPolicy(value: unknown): value is Policy {
  if (!value || typeof value !== "object") return false;
  const p = value as Policy;
  return (
    p.approved === true &&
    typeof p.version === "string" &&
    p.version.length > 0 &&
    Array.isArray(p.rules) &&
    p.rules.length > 0 &&
    p.rules.length <= 200 &&
    p.rules.every(
      (r) =>
        !!r && typeof r === "object" && ["hate", "harassment", "threat", "spam", "abuse"].includes(
          r.category,
        ) &&
        typeof r.phrase === "string" &&
        r.phrase.trim().length >= 3 &&
        r.phrase.length <= 200 &&
        ["hide", "review"].includes(r.action),
    )
  );
}
export function classify(content: string, policy: Policy): Decision {
  const base = {
    categories: [] as string[],
    policyVersion: policy.version || "unconfigured",
  };
  if (!validPolicy(policy))
    return {
      ...base,
      decision: "review",
      reason: "Policy is not approved or is invalid.",
      actionStatus: "review",
    };
  const normal = content.normalize("NFKC").toLocaleLowerCase("en-GB");
  const matches = policy.rules.filter((r) =>
    normal.includes(
      r.phrase.trim().normalize("NFKC").toLocaleLowerCase("en-GB"),
    ),
  );
  if (!matches.length)
    return {
      ...base,
      decision: "allow",
      reason:
        "No configured rule matched. This is not a comprehensive safety assessment.",
      actionStatus: "none",
    };
  const categories = [...new Set(matches.map((r) => r.category))];
  // Context/sensitive speech is always reviewed. Operators opt each phrase into hiding.
  const uncertain =
    /["“”]|\b(not|never|against|report|reported|quoting|condemn|reclaim)\b/i.test(
      normal,
    ) ||
    categories.includes("threat") ||
    categories.includes("hate");
  const hide = !uncertain && matches.every((r) => r.action === "hide");
  return {
    ...base,
    categories,
    decision: hide ? "hide" : "review",
    reason: uncertain
      ? "Sensitive or contextual language requires human review."
      : "Matched approved phrase policy.",
    actionStatus: hide ? "applied" : "review",
  };
}
export function normalizeEvents(
  payload: unknown,
  accounts: Record<Platform, string>,
): Event[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as {
    object?: string;
    entry?: {
      id?: string;
      changes?: { field?: string; value?: Record<string, unknown> }[];
    }[];
  };
  if (!Array.isArray(root.entry)) return [];
  const events: Event[] = [];
  for (const entry of root.entry) {
    if (!entry || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!change) continue;
      const v = change.value;
      if (!v) continue;
      const platform =
        root.object === "page"
          ? "facebook"
          : root.object === "instagram"
            ? "instagram"
            : null;
      if (!platform || !accounts[platform] || entry.id !== accounts[platform])
        continue;
      const supported =
        platform === "facebook"
          ? change.field === "feed" &&
            v.item === "comment" &&
            ["add", "edited"].includes(String(v.verb))
          : change.field === "comments";
      const id = platform === "facebook" ? v.comment_id : v.id;
      const text = platform === "facebook" ? v.message : v.text;
      if (
        supported &&
        typeof id === "string" &&
        /^[\d_]+$/.test(id) &&
        typeof text === "string" &&
        text.length <= 20000
      ) {
        events.push({
          platform,
          account_id: entry.id!,
          comment_id: id,
          content: text,
        });
      }
    }
  }
  return events;
}
export function effectiveStatus(
  s: { enabled: boolean; status: string; heartbeat_at: string | null },
  now: number,
): string {
  if (!s.enabled) return "Stopped";
  if (
    s.status === "Running" &&
    (!s.heartbeat_at || now - Date.parse(s.heartbeat_at) > 150000)
  )
    return "Error";
  return s.status;
}
export function uptime(start: string | null, now: number): string {
  let t = Math.max(0, Math.floor((now - Date.parse(start || "")) / 1000));
  if (!Number.isFinite(t)) return "—";
  const days = Math.floor(t / 86400);
  t %= 86400;
  const hours = Math.floor(t / 3600);
  t %= 3600;
  return `${days}d ${hours}h ${Math.floor(t / 60)}m ${t % 60}s`;
}
