export function createBugReference(): string {
  const now = new Date();

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  const randomPart = crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase();

  return `BUG-${year}${month}${day}-${randomPart}`;
}