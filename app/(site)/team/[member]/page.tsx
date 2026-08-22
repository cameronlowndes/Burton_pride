"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Mail,
  Quote,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Member = {
  id: string;
  full_name: string;
  email: string | null;
  image_url: string | null;
  role: string;
  pronouns: string | null;
  section_title: string;
  story_title: string | null;
  story: string | null;
  display_order: number;
  is_published: boolean;
};

type CommitteeApiResponse = {
  ok: boolean;
  error?: string;
  members?: Member[];
};

function slugifyName(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export default function TeamMemberPage() {
  const params = useParams();
  const router = useRouter();

  const memberSlug = String(params.member || "");

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMembers() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/committee", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const data: CommitteeApiResponse =
          await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(
            data.error ||
              "Failed to load committee members",
          );
        }

        setMembers(
          (data.members || []).filter(
            (item) => item.is_published,
          ),
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load committee members",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadMembers();

    return () => {
      controller.abort();
    };
  }, []);

  const member = useMemo(() => {
    return members.find(
      (item) =>
        slugifyName(item.full_name) === memberSlug,
    );
  }, [members, memberSlug]);

  const storyLines = useMemo(() => {
    if (!member?.story?.trim()) {
      return [];
    }

    return member.story
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [member]);

  if (loading) {
    return (
      <main
        className="
          min-h-screen
          px-4
          pb-24
          pt-28

          sm:px-6
          sm:pt-32

          lg:px-8
        "
      >
        <div
          className="
            mx-auto
            max-w-5xl
            rounded-3xl
            border
            border-white/50
            bg-white/80
            px-6
            py-12
            text-center
            text-slate-900
            shadow-xl
            backdrop-blur-md

            dark:border-white/10
            dark:bg-[#111827]/90
            dark:text-white
          "
        >
          <div
            className="
              mx-auto
              h-10
              w-10
              animate-spin
              rounded-full
              border-4
              border-slate-200
              border-t-purple-600

              dark:border-white/10
              dark:border-t-purple-400
            "
          />

          <p className="mt-4 text-lg font-bold">
            Loading team member...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        className="
          min-h-screen
          px-4
          pb-24
          pt-28

          sm:px-6
          sm:pt-32

          lg:px-8
        "
      >
        <div
          className="
            mx-auto
            max-w-4xl
            rounded-3xl
            border
            border-red-200
            bg-red-50
            px-6
            py-10
            text-center
            text-red-800
            shadow-xl

            dark:border-red-500/20
            dark:bg-red-950/30
            dark:text-red-200
          "
        >
          <h1 className="text-3xl font-black">
            Something went wrong
          </h1>

          <p className="mt-3">
            {error}
          </p>

          <button
            type="button"
            onClick={() => router.push("/MeetUs")}
            className="
              mt-6
              inline-flex
              items-center
              gap-2
              rounded-full
              bg-purple-600
              px-6
              py-3
              font-black
              text-white
              shadow-lg
              transition

              hover:bg-purple-500
            "
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Team
          </button>
        </div>
      </main>
    );
  }

  if (!member) {
    return (
      <main
        className="
          min-h-screen
          px-4
          pb-24
          pt-28

          sm:px-6
          sm:pt-32

          lg:px-8
        "
      >
        <div
          className="
            mx-auto
            max-w-4xl
            rounded-3xl
            border
            border-white/50
            bg-white/80
            px-6
            py-10
            text-center
            text-slate-900
            shadow-xl
            backdrop-blur-md

            dark:border-white/10
            dark:bg-[#111827]/90
            dark:text-white
          "
        >
          <UserRound
            className="
              mx-auto
              h-10
              w-10
              text-purple-600

              dark:text-purple-300
            "
          />

          <h1 className="mt-4 text-3xl font-black">
            Member not found
          </h1>

          <p
            className="
              mt-3
              text-slate-600

              dark:text-white/70
            "
          >
            We couldn&apos;t find that team member.
          </p>

          <button
            type="button"
            onClick={() => router.push("/MeetUs")}
            className="
              mt-6
              inline-flex
              items-center
              gap-2
              rounded-full
              bg-purple-600
              px-6
              py-3
              font-black
              text-white
              shadow-lg
              transition

              hover:bg-purple-500
            "
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Team
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="
        min-h-screen
        px-4
        pb-24
        pt-28
        text-slate-950

        sm:px-6
        sm:pt-32

        lg:px-8

        dark:text-white
      "
    >
      <div className="mx-auto max-w-6xl">
        {/* BACK BUTTON */}
        <button
          type="button"
          onClick={() => router.back()}
          className="
            mb-6
            inline-flex
            items-center
            gap-2
            rounded-full
            border
            border-white/50
            bg-white/80
            px-5
            py-3
            text-sm
            font-black
            text-slate-800
            shadow-sm
            backdrop-blur-md
            transition

            hover:bg-white

            dark:border-white/10
            dark:bg-white/[0.05]
            dark:text-white
            dark:hover:bg-white/[0.1]
          "
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Team
        </button>

        {/* PROFILE */}
        <section
          className="
            overflow-hidden
            rounded-[32px]
            border
            border-white/60
            bg-white/90
            shadow-[0_24px_70px_rgba(15,23,42,0.14)]
            backdrop-blur-md

            dark:border-white/10
            dark:bg-[#111827]/90
            dark:shadow-black/40
          "
        >
          <div
            className="
              grid

              lg:grid-cols-[0.75fr_1.25fr]
            "
          >
            {/* LEFT PROFILE PANEL */}
            <aside
              className="
                relative
                flex
                flex-col
                items-center
                justify-center
                overflow-hidden
                bg-gradient-to-br
                from-pink-500
                via-purple-600
                to-blue-600
                px-6
                py-10
                text-center
                text-white

                sm:px-8
                sm:py-12

                lg:min-h-[620px]
              "
            >
              <div
                aria-hidden="true"
                className="
                  pointer-events-none
                  absolute
                  -left-20
                  -top-20
                  h-64
                  w-64
                  rounded-full
                  bg-white/15
                  blur-3xl
                "
              />

              <div
                aria-hidden="true"
                className="
                  pointer-events-none
                  absolute
                  -bottom-24
                  -right-20
                  h-72
                  w-72
                  rounded-full
                  bg-blue-300/20
                  blur-3xl
                "
              />

              <div className="relative">
                <div
                  className="
                    relative
                    mx-auto
                    h-40
                    w-40
                    overflow-hidden
                    rounded-full
                    border-4
                    border-white
                    shadow-2xl

                    sm:h-48
                    sm:w-48
                  "
                >
                  <Image
                    src={
                      member.image_url ||
                      "/image/Logo.png"
                    }
                    alt={member.full_name}
                    fill
                    unoptimized
                    sizes="192px"
                    className="object-cover"
                  />
                </div>

                <p
                  className="
                    mt-6
                    text-xs
                    font-black
                    uppercase
                    tracking-[0.18em]
                    text-yellow-300
                  "
                >
                  {member.section_title}
                </p>

                <h1
                  className="
                    mt-3
                    text-4xl
                    font-black
                    leading-tight
                    text-white

                    sm:text-5xl
                  "
                >
                  {member.full_name}
                </h1>

                <p
                  className="
                    mt-3
                    text-lg
                    font-bold
                    text-white/90
                  "
                >
                  {member.role}
                </p>

                {member.pronouns ? (
                  <span
                    className="
                      mt-5
                      inline-flex
                      rounded-full
                      border
                      border-white/20
                      bg-white/15
                      px-4
                      py-2
                      text-sm
                      font-bold
                      text-white
                      backdrop-blur-md
                    "
                  >
                    {member.pronouns}
                  </span>
                ) : null}

                {member.email ? (
                  <a
                    href={`mailto:${member.email}`}
                    className="
                      mt-6
                      inline-flex
                      max-w-full
                      items-center
                      gap-2
                      rounded-full
                      bg-white
                      px-5
                      py-3
                      text-sm
                      font-black
                      text-purple-700
                      shadow-lg
                      transition

                      hover:scale-[1.02]
                      hover:bg-yellow-300
                      hover:text-purple-950
                    "
                  >
                    <Mail className="h-4 w-4 shrink-0" />

                    <span className="truncate">
                      {member.email}
                    </span>
                  </a>
                ) : null}
              </div>
            </aside>

            {/* STORY */}
            <div
              className="
                p-6

                sm:p-8

                lg:p-10
              "
            >
              <p
                className="
                  text-sm
                  font-black
                  uppercase
                  tracking-[0.16em]
                  text-purple-700

                  dark:text-purple-300
                "
              >
                Meet the team
              </p>

              <h2
                className="
                  mt-2
                  text-3xl
                  font-black
                  text-slate-950

                  sm:text-4xl

                  dark:text-white
                "
              >
                {member.story_title ||
                  `About ${member.full_name}`}
              </h2>

              {storyLines.length > 0 ? (
                <div
                  className="
                    mt-7
                    space-y-6
                    text-base
                    leading-8
                    text-slate-700

                    sm:text-lg

                    dark:text-white/80
                  "
                >
                  {storyLines.map(
                    (paragraph, index) => (
                      <p key={index}>
                        {paragraph}
                      </p>
                    ),
                  )}
                </div>
              ) : (
                <div
                  className="
                    mt-7
                    rounded-3xl
                    border
                    border-slate-200
                    bg-slate-50
                    p-6
                    text-slate-600

                    dark:border-white/10
                    dark:bg-white/[0.04]
                    dark:text-white/60
                  "
                >
                  <Quote
                    className="
                      h-6
                      w-6
                      text-purple-500

                      dark:text-purple-300
                    "
                  />

                  <p className="mt-3 italic">
                    Story coming soon.
                  </p>
                </div>
              )}

              <div
                className="
                  mt-10
                  border-t
                  border-slate-200
                  pt-6

                  dark:border-white/10
                "
              >
                <p
                  className="
                    text-sm
                    leading-6
                    text-slate-500

                    dark:text-white/50
                  "
                >
                  Burton Pride is built by local people
                  who give their time, experience and
                  energy to support the LGBTQIA+
                  community in Burton upon Trent.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}