import type {
  Metadata,
} from "next";

import LotterySlugClient from "../../components/Client/LotteryManagement/LotterySlugClient";

import {
  supabaseAdmin,
} from "@/lib/supabase/supabaseAdmin";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const {
    slug,
  } =
    await params;

  const {
    data,
  } =
    await supabaseAdmin
      .from("lotteries")
      .select(
        `
        title,
        short_summary,
        hero_image_url
        `,
      )
      .eq(
        "slug",
        slug,
      )
      .maybeSingle();

  if (!data) {
    return {
      title:
        "Lottery | Burton Pride",
      description:
        "Burton Pride fundraising lottery.",
    };
  }

  return {
    title: `${data.title} | Burton Pride`,

    description:
      data.short_summary ||
      `Take part in ${data.title} and support Burton Pride.`,

    openGraph: {
      title:
        data.title,

      description:
        data.short_summary ||
        `Take part in ${data.title}.`,

      images:
        data.hero_image_url
          ? [
              data.hero_image_url,
            ]
          : undefined,
    },
  };
}

export default async function LotterySlugPage({
  params,
}: PageProps) {
  const {
    slug,
  } =
    await params;

  return (
    <LotterySlugClient
      slug={slug}
    />
  );
}