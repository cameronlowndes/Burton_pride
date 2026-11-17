/** The shared inbox must not expose moderation alerts through a general portal permission. */
const otherSources = new Set(["dashboard", "bug_tracker", "email", "event_hub", "lottery", "money", "stock"]);
export function moderationAlert(item: Record<string, unknown>): boolean {
  return !otherSources.has(String(item.source_app)) || Boolean(item.job_id) ||
    (typeof item.destination === "string" && /^\/Admin\/(?:Dashboard\/)?SocialMediaModeration(?:\/|\?|$)/i.test(item.destination));
}
export function filterModerationFeed(value: unknown, canModeration: boolean): Record<string, unknown> {
  if (!value || typeof value !== "object" || !Array.isArray((value as { items?: unknown }).items)) throw new Error("Invalid notification feed");
  const feed = value as Record<string, unknown> & { items: unknown[] };
  const items = feed.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => canModeration || !moderationAlert(item));
  const safe: Record<string, unknown> = { enabled: feed.enabled === true, autoRefresh: feed.autoRefresh,
    adminId: feed.adminId, hasNext: feed.hasNext === true, items, canModeration,
    // Do not reveal a count of hidden moderation alerts. Without moderation
    // access this count describes unread rows on the loaded page.
    unreadCount: canModeration ? feed.unreadCount : items.filter((item) => !item.read_at).length };
  for (const key of ["canDashboard", "canBugTracker", "canEmail", "canEventHub", "canLottery", "canMoney", "canStock"]) {
    if (key in feed) safe[key] = feed[key] === true;
  }
  return safe;
}
