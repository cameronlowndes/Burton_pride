import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import PageStatusCard, {
  type PageStatusCardProps,
  type PageStatusIconName,
  type PageStatusMode,
} from "./PageStatusCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Reason = "hidden" | "disabled" | "coming_soon" | "password";

type PageData = {
  id: string;
  route: string;
  title: string | null;
  hidden_title: string | null;
  hidden_message: string | null;
  coming_soon_title: string | null;
  coming_soon_message: string | null;
  locked_title: string | null;
  locked_message: string | null;
};

type PageStatusParams = {
  route?: string[];
};

type PageStatusSearchParams = {
  route?: string;
  reason?: string;
};

function normalisePath(value: string) {
  if (!value || value === "home" || value === "/home") return "/";

  const cleanValue = value.split("?")[0].split("#")[0].trim();

  if (!cleanValue || cleanValue === "home" || cleanValue === "/home") {
    return "/";
  }

  const withSlash = cleanValue.startsWith("/") ? cleanValue : `/${cleanValue}`;

  return withSlash.endsWith("/") && withSlash !== "/"
    ? withSlash.slice(0, -1)
    : withSlash;
}

function cleanReason(value: string | undefined): Reason {
  if (
    value === "hidden" ||
    value === "disabled" ||
    value === "coming_soon" ||
    value === "password"
  ) {
    return value;
  }

  return "hidden";
}

async function getPage(route: string) {
  const normalisedRoute = normalisePath(route);
  const lowerRoute = normalisedRoute.toLowerCase();

  const { data, error } = await supabaseAdmin
    .from("site_pages")
    .select(
      "id, route, title, hidden_title, hidden_message, coming_soon_title, coming_soon_message, locked_title, locked_message"
    )
    .in("route", [normalisedRoute, lowerRoute])
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Page status load error:", error.message);
    return null;
  }

  return data as PageData | null;
}

function buildCardProps({
  page,
  route,
  reason,
}: {
  page: PageData | null;
  route: string;
  reason: Reason;
}): PageStatusCardProps {
  const mode: PageStatusMode =
    reason === "password"
      ? "locked"
      : reason === "coming_soon"
      ? "coming_soon"
      : reason === "disabled"
      ? "disabled"
      : "hidden";

  const badge =
    reason === "password"
      ? "Password protected"
      : reason === "coming_soon"
      ? "Coming soon"
      : reason === "disabled"
      ? "Page disabled"
      : "Page hidden";

  const iconName: PageStatusIconName =
    reason === "password"
      ? "lock"
      : reason === "coming_soon"
      ? "clock"
      : "hidden";

  const title =
    reason === "password"
      ? page?.locked_title || "This page is locked"
      : reason === "coming_soon"
      ? page?.coming_soon_title || "Coming soon"
      : page?.hidden_title || "This page is not available";

  const message =
    reason === "password"
      ? page?.locked_message ||
        "This page is password protected. Please enter the password to continue."
      : reason === "coming_soon"
      ? page?.coming_soon_message ||
        "We are updating this page right now. Please check back soon."
      : page?.hidden_message || "This page is not currently available.";

  return {
    mode,
    pageId: page?.id || "",
    route,
    badge,
    title,
    message,
    iconName,
  };
}

export default async function PageStatus({
  params,
  searchParams,
}: {
  params: Promise<PageStatusParams>;
  searchParams: Promise<PageStatusSearchParams>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const routeFromFolder = normalisePath(
    (resolvedParams.route || []).join("/")
  );

  const route = normalisePath(resolvedSearchParams.route || routeFromFolder);
  const reason = cleanReason(resolvedSearchParams.reason);
  const page = await getPage(route);

  const cardProps = buildCardProps({
    page,
    route,
    reason,
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-transparent px-4 py-12 text-white">
      <PageStatusCard {...cardProps} />
    </main>
  );
}