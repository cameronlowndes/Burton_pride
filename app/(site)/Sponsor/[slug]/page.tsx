import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Sponsor } from "@/types/sponsor";

async function getSponsor(slug: string): Promise<Sponsor | null> {
  const { data, error } = await supabaseAdmin
    .from("sponsor_applications")
    .select(
      "id, sponsor_name, sponsorship_type, logo_link, story, message, slug, status"
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .single();

  if (error || !data) return null;

  return {
    id: String(data.id),
    sponsor_name: data.sponsor_name ?? "",
    sponsorship_type: data.sponsorship_type ?? null,
    logo_link: data.logo_link ?? null,
    story: data.story ?? data.message ?? null,
    slug: data.slug ?? null,
    status: data.status ?? null,
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

  return (
    <main className="min-h-screen bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-4 pt-28 pb-10 text-white sm:px-6 md:px-8 md:pt-32">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl md:p-10">
        <div className="relative mx-auto mb-8 h-48 w-full max-w-sm overflow-hidden rounded-3xl bg-white">
          {sponsor.logo_link ? (
            <Image
              src={sponsor.logo_link}
              alt={sponsor.sponsor_name}
              fill
              className="object-contain p-5"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              No logo
            </div>
          )}
        </div>

        <div className="mb-4 text-center">
          <span className="inline-flex rounded-full border border-yellow-300/30 bg-yellow-400/20 px-4 py-1 text-sm font-semibold text-yellow-100">
            {sponsor.sponsorship_type || "Sponsor"}
          </span>
        </div>

        <h1 className="text-center text-4xl font-extrabold sm:text-5xl">
          {sponsor.sponsor_name}
        </h1>

        <div className="mt-8 rounded-2xl bg-black/10 p-5">
          <p className="whitespace-pre-line text-base leading-8 text-white/95 sm:text-lg">
            {sponsor.story?.trim() || "No sponsor story has been added yet."}
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/Sponsor"
            className="inline-flex rounded-full bg-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/25"
          >
            ← Back to Sponsors
          </Link>
        </div>
      </div>
    </main>
  );
}