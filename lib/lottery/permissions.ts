/** Only explicit database grants count; strings/numbers are not booleans. */
export function normaliseLotteryPermissions(value: unknown): string[] {
  const keys = Array.isArray(value) ? value :
    value && typeof value === "object" ? Object.entries(value).filter(([, granted]) => granted === true).map(([key]) => key) : [];
  return [...new Set(keys.filter((key): key is string => typeof key === "string" && /^lottery:[a-z][a-z0-9_-]*(?::[a-z][a-z0-9_-]*)*$/.test(key)))];
}
