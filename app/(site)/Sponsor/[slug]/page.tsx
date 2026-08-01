import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

type SponsorStoryPageData = {
  id: string;
  sponsor_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  sponsorship_type: string | null;
  sponsor_display_type: string | null;
  is_main_sponsor: boolean;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  logo_link: string | null;
  website: string | null;
  message: string | null;
  story: string | null;
  slug: string | null;
  status: string;
  created_at: string;
  display_order: number | null;
};

function formatSponsorType(value?: string | null) {
  const raw = String(value || "").trim();

  if (!raw) return "Sponsor";

  return raw
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getSponsorBadge(sponsor: SponsorStoryPageData) {
  if (sponsor.is_main_sponsor) return "Main Sponsor";

  if (sponsor.sponsor_display_type) {
    return sponsor.sponsor_display_type;
  }

  const type = sponsor.sponsorship_type;

  if (!type) return "Sponsor";

  const value = type.toLowerCase();

  if (value.includes("gold")) return "Gold Sponsor";
  if (value.includes("silver")) return "Silver Sponsor";
  if (value.includes("bronze")) return "Bronze Sponsor";

  return formatSponsorType(type);
}

async function getSponsor(slug: string): Promise<SponsorStoryPageData | null> {
  const { data, error } = await supabaseAdmin
    .from("sponsor_applications")
    .select(
      `
        id,
        sponsor_name,
        contact_name,
        email,
        phone,
        sponsorship_type,
        address_line1,
        address_line2,
        city,
        county,
        postcode,
        country,
        logo_link,
        website,
        message,
        story,
        slug,
        status,
        created_at,
        display_order,
        is_main_sponsor
      `
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .single();

  if (error || !data) return null;

  const isMainSponsor = Boolean(data.is_main_sponsor);
  const story = String(data.story || data.message || "").trim();

  return {
    id: String(data.id),
    sponsor_name: data.sponsor_name ?? "",
    contact_name: data.contact_name ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    sponsorship_type: data.sponsorship_type ?? null,
    sponsor_display_type: isMainSponsor
      ? "Main Sponsor"
      : formatSponsorType(data.sponsorship_type),
    is_main_sponsor: isMainSponsor,
    address_line1: data.address_line1 ?? null,
    address_line2: data.address_line2 ?? null,
    city: data.city ?? null,
    county: data.county ?? null,
    postcode: data.postcode ?? null,
    country: data.country ?? null,
    logo_link: data.logo_link ?? null,
    website: data.website ?? null,
    message: data.message ?? null,
    story: story || null,
    slug: data.slug ?? null,
    status: data.status ?? "approved",
    created_at: data.created_at ?? "",
    display_order:
      typeof data.display_order === "number" ? data.display_order : null,
  };
}

export default async function SponsorStoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sponsor = await getSponsor(slug);

  if (!sponsor) notFound();

  const isMainSponsor = sponsor.is_main_sponsor;
  const sponsorStory =
    sponsor.story?.trim() || "No sponsor story has been added yet.";

  return (
    <main className="min-h-screen bg-gradient-to-r px-4 pb-10 pt-28 text-white sm:px-6 md:px-8 md:pt-32">
      <div
        className={
          isMainSponsor
            ? "mx-auto max-w-4xl overflow-hidden rounded-[36px] border-4 border-yellow-300 bg-gradient-to-br from-yellow-300 via-orange-200 to-pink-200 p-1 shadow-[0_0_70px_rgba(250,204,21,0.65)]"
            : "mx-auto max-w-3xl rounded-[32px] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl md:p-10"
        }
      >
        <div
          className={
            isMainSponsor
              ? "relative overflow-hidden rounded-[32px] bg-white/90 p-6 text-purple-950 backdrop-blur-xl md:p-10"
              : ""
          }
        >
          {isMainSponsor && (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.35),transparent_40%)]" />
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-yellow-300/50 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-pink-400/30 blur-3xl" />
            </>
          )}

          <div className="relative">
            <div
              className={
                isMainSponsor
                  ? "relative mx-auto mb-8 h-60 w-full max-w-md overflow-hidden rounded-3xl border-4 border-yellow-300 bg-white shadow-2xl shadow-yellow-500/40"
                  : "relative mx-auto mb-8 h-48 w-full max-w-sm overflow-hidden rounded-3xl bg-white"
              }
            >
              {sponsor.logo_link ? (
                <Image
                  src={sponsor.logo_link}
                  alt={sponsor.sponsor_name}
                  fill
                  className={
                    isMainSponsor
                      ? "object-contain p-7"
                      : "object-contain p-5"
                  }
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">
                  No logo
                </div>
              )}
            </div>

            <div className="mb-4 text-center">
              <span
                className={
                  isMainSponsor
                    ? "inline-flex rounded-full bg-yellow-400 px-6 py-2 text-sm font-black uppercase tracking-[0.22em] text-purple-950 shadow-xl ring-4 ring-yellow-200"
                    : "inline-flex rounded-full border border-yellow-300/30 bg-yellow-400/20 px-4 py-1 text-sm font-semibold text-yellow-100"
                }
              >
                {getSponsorBadge(sponsor)}
              </span>
            </div>

            <h1
              className={
                isMainSponsor
                  ? "text-center text-4xl font-black leading-tight text-purple-950 sm:text-6xl"
                  : "text-center text-4xl font-extrabold sm:text-5xl"
              }
            >
              {sponsor.sponsor_name}
            </h1>

            {isMainSponsor && (
              <div className="mt-5 text-center">
                <span className="inline-flex rounded-full bg-purple-950 px-5 py-2 text-xs font-black uppercase tracking-[0.22em] text-yellow-300 shadow-lg">
                  Proud Main Sponsor of Burton Pride
                </span>
              </div>
            )}

            <div
              className={
                isMainSponsor
                  ? "mt-8 rounded-3xl border-2 border-yellow-300 bg-yellow-50 p-6 shadow-xl"
                  : "mt-8 rounded-2xl bg-black/10 p-5"
              }
            >
              <p
                className={
                  isMainSponsor
                    ? "whitespace-pre-line text-base font-semibold leading-8 text-purple-900 sm:text-lg"
                    : "whitespace-pre-line text-base leading-8 text-white/95 sm:text-lg"
                }
              >
                {sponsorStory}
              </p>
            </div>

            {sponsor.website && (
              <div className="mt-8 text-center">
                <Link
                  href={sponsor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    isMainSponsor
                      ? "inline-flex rounded-full bg-purple-950 px-6 py-3 font-bold text-yellow-300 shadow-lg transition hover:scale-105 hover:bg-purple-900"
                      : "inline-flex rounded-full bg-yellow-400 px-6 py-3 font-bold text-black shadow-lg transition hover:scale-105 hover:bg-yellow-300"
                  }
                >
                  Visit Sponsor Website
                </Link>
              </div>
            )}

            <div className="mt-8 text-center">
              <Link
                href="/Sponsors"
                className={
                  isMainSponsor
                    ? "inline-flex rounded-full bg-white px-6 py-3 font-bold text-purple-950 shadow-lg transition hover:scale-105 hover:bg-yellow-100"
                    : "inline-flex rounded-full bg-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/25"
                }
              >
                ← Back to Sponsors
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}