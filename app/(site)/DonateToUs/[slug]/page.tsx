import DonationsContent from "../../components/Client/DonateClient";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

type Supporter = {
  id: string;
  full_name: string | null;
  supporter_story: string | null;
  supporter_image_url: string | null;
  supporter_story_status: string | null;
  supporter_wall_approved: boolean | null;
  donation_type: string | null;
  pronouns: string | null;
  identity_label: string | null;
};

function makeSlug(name: string | null, id: string) {
  const safeName = (name || "supporter")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${safeName}-${id}`;
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;

  const { data, error } = await supabaseAdmin
    .from("donations")
    .select(
      `
      id,
      full_name,
      supporter_story,
      supporter_image_url,
      supporter_story_status,
      supporter_wall_approved,
      donation_type,
      pronouns,
      identity_label
    `
    )
    .eq("donation_type", "monthly")
    .eq("supporter_story_status", "approved")
    .eq("supporter_wall_approved", true)
    .returns<Supporter[]>();

  if (error || !data) notFound();

  const supporter = data.find(
    (item) => makeSlug(item.full_name, item.id) === slug
  );

  if (!supporter) notFound();

  const paragraphs = (supporter.supporter_story || "No story yet.")
    .split("\n")
    .filter(Boolean);

  const supporterImage = supporter.supporter_image_url || "/image/Logo.png";
  const hasCustomImage = Boolean(supporter.supporter_image_url);

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <div className="hidden lg:block">
        <div className="pointer-events-none fixed inset-0 select-none overflow-hidden blur-md brightness-50">
          <div className="min-h-screen overflow-hidden">
            <DonationsContent />
          </div>
        </div>

        <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm" />

        <div className="fixed inset-0 z-50 flex items-center justify-center px-8 py-8">
          <section className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[30px] border border-white/20 bg-gradient-to-br from-purple-700 via-fuchsia-700 to-pink-700 p-12 text-white shadow-[0_25px_90px_rgba(0,0,0,0.65)]">
            <Link
              href="/DonateToUs"
              className="absolute right-5 top-5 rounded-full border border-white/20 bg-white/15 px-5 py-2 text-sm font-bold text-white transition hover:bg-white/25"
            >
              Close
            </Link>

            <div className="flex flex-col items-center text-center">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white/45 bg-white/20 shadow-xl">
                <Image
                  src={supporterImage}
                  alt={supporter.full_name || "Supporter"}
                  width={180}
                  height={180}
                  unoptimized
                  className={
                    hasCustomImage
                      ? "h-full w-full object-cover"
                      : "h-full w-full object-contain p-5"
                  }
                />
              </div>

              <h1 className="mt-6 text-5xl font-black">
                {supporter.full_name || "Community Supporter"}
              </h1>

              <p className="mt-3 text-lg font-bold text-white/95">
                Monthly Pride Supporter
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-3">
              

                {supporter.pronouns && (
                  <span className="rounded-full border border-white/20 bg-white/15 px-5 py-2 text-sm font-bold">
                    {supporter.pronouns}
                  </span>
                )}

                {supporter.identity_label && (
                  <span className="rounded-full border border-white/20 bg-white/15 px-5 py-2 text-sm font-bold">
                    {supporter.identity_label}
                  </span>
                )}
              </div>
            </div>

            <h2 className="mt-10 text-center text-3xl font-black text-yellow-300">
              Why I Support Burton Pride
            </h2>

            <div className="mt-8 space-y-6 text-lg leading-9 text-white/95">
              {paragraphs.map((paragraph: string, index: number) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

          </section>
        </div>
      </div>

      <div className="block min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 px-3 py-8 lg:hidden">
        <section className="mx-auto overflow-hidden rounded-[28px] border border-white/20 bg-white/15 shadow-2xl backdrop-blur-xl">
          <div className="px-6 pb-10 pt-10 text-center">
            <div className="mx-auto h-36 w-36 overflow-hidden rounded-full border-4 border-white/50 bg-white/20 shadow-xl">
              <Image
                src={supporterImage}
                alt={supporter.full_name || "Supporter"}
                width={180}
                height={180}
                unoptimized
                className={
                  hasCustomImage
                    ? "h-full w-full object-cover"
                    : "h-full w-full object-contain p-5"
                }
              />
            </div>

            <h1 className="mt-8 text-4xl font-black leading-tight">
              {supporter.full_name || "Community Supporter"}
            </h1>

            <p className="mt-4 text-xl font-bold text-white/95">
              Monthly Pride Supporter
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <span className="rounded-full border border-white/20 bg-white/15 px-5 py-2 text-sm font-bold">
                Burton Pride Supporter
              </span>

              {supporter.pronouns && (
                <span className="rounded-full border border-white/20 bg-white/15 px-5 py-2 text-sm font-bold">
                  {supporter.pronouns}
                </span>
              )}

              {supporter.identity_label && (
                <span className="rounded-full border border-white/20 bg-white/15 px-5 py-2 text-sm font-bold">
                  {supporter.identity_label}
                </span>
              )}
            </div>
          </div>

          <div className="bg-white/10 px-5 py-10">
            <h2 className="text-center text-2xl font-black text-yellow-300">
              Why I Support Burton Pride
            </h2>

            <div className="mt-8 space-y-5">
              {paragraphs.map((paragraph: string, index: number) => (
                <p
                  key={index}
                  className="rounded-2xl border border-white/15 bg-white/10 p-5 text-center text-base leading-8 text-white/95 shadow-lg"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <Link
                href="/DonateToUs"
                className="rounded-full bg-white/20 px-7 py-3 text-sm font-black text-white transition hover:bg-white/30"
              >
                ← Back to Donations
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}