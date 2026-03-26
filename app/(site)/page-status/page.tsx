import { unstable_noStore as noStore } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import PageStatusCard from "./PageStatusCard";

type PageStatusSearchParams = Promise<{
  mode?: string;
  from?: string;
}>;

type SitePageRow = {
  id: string;
  title: string;
  route: string;
  hidden_title: string | null;
  hidden_message: string | null;
  coming_soon_title: string | null;
  coming_soon_message: string | null;
  locked_title: string | null;
  locked_message: string | null;
  password_protected: boolean;
};

function normalisePath(pathname: string) {
  if (!pathname) return "/";
  const onlyPath = pathname.split("?")[0].split("#")[0];
  if (!onlyPath || onlyPath === "/") return "/";
  return onlyPath.endsWith("/") ? onlyPath.slice(0, -1) : onlyPath;
}

async function getManagedPage(route: string): Promise<SitePageRow | null> {
  const admin = supabaseAdmin;
  const normalisedRoute = normalisePath(route);

  const { data, error } = await admin
    .from("site_pages")
    .select(
      `
        id,
        title,
        route,
        hidden_title,
        hidden_message,
        coming_soon_title,
        coming_soon_message,
        locked_title,
        locked_message,
        password_protected
      `
    )
    .eq("route", normalisedRoute)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export default async function PageStatusPage({
  searchParams,
}: {
  searchParams: PageStatusSearchParams;
}) {
  noStore();

  const params = await searchParams;
  const mode = params.mode || "hidden";
  const from = normalisePath(params.from || "/");

  const page = await getManagedPage(from);

  const isLocked = mode === "locked";
  const isComingSoon = mode === "coming_soon";

  const badge = isLocked
    ? "LOCKED PAGE"
    : isComingSoon
    ? "COMING SOON"
    : "HIDDEN BY ADMIN";

  const fallbackTitle = isLocked
    ? "This page is locked"
    : isComingSoon
    ? "This page is coming soon"
    : "This page has been hidden";

  const fallbackMessage = isLocked
    ? "This page is password protected. Enter the password below to continue."
    : isComingSoon
    ? "We are updating this page right now. Please check back soon."
    : "This page has been hidden by the admin portal and is not currently available.";

  const title = isLocked
    ? page?.locked_title?.trim() || fallbackTitle
    : isComingSoon
    ? page?.coming_soon_title?.trim() || fallbackTitle
    : page?.hidden_title?.trim() || fallbackTitle;

  const message = isLocked
    ? page?.locked_message?.trim() || fallbackMessage
    : isComingSoon
    ? page?.coming_soon_message?.trim() || fallbackMessage
    : page?.hidden_message?.trim() || fallbackMessage;

  const iconName = isLocked ? "lock" : isComingSoon ? "clock" : "hidden";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-220px)] w-full max-w-7xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <PageStatusCard
        mode={mode}
        pageId={page?.id ?? ""}
        route={from}
        badge={badge}
        title={title}
        message={message}
        iconName={iconName}
      />
    </main>
  );
}