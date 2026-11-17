import { redirect } from "next/navigation";
import { MODERATION_ROUTES, safeNavigationHref } from "@/lib/moderation/navigation";
export const dynamic = "force-dynamic";
export default async function LegacyModerationPage({ params, searchParams }: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path = [] } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((part) => query.append(key, part));
    else if (value !== undefined) query.set(key, value);
  }
  const target = path.length ? MODERATION_ROUTES.welcome + "/" + path.map(encodeURIComponent).join("/") : MODERATION_ROUTES.home;
  redirect((safeNavigationHref(target) || MODERATION_ROUTES.home) + (query.size ? "?" + query.toString() : ""));
}
