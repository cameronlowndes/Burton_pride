"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  Mail,
  MessageCircleMore,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

type Member = {
  id: string;
  full_name: string;
  email: string | null;
  image_url: string | null;
  role: string;
  pronouns: string | null;
  section_title: string;
  story_title?: string | null;
  story: string | null;
  display_order: number;
  is_published: boolean;
  image_position_x: number | null;
  image_position_y: number | null;
};

type Section = {
  title: string;
  members: Member[];
};

type CommitteeApiResponse = {
  ok: boolean;
  error?: string;
  members?: Member[];
};

const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: (index: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.06,
      duration: 0.5,
      ease: "easeOut",
    },
  }),
};

function slugifyName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function clamp(
  number: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(Math.max(number, minimum), maximum);
}

function getImagePosition(member: Member) {
  const x =
    typeof member.image_position_x === "number"
      ? member.image_position_x
      : 50;

  const rawY =
    typeof member.image_position_y === "number"
      ? member.image_position_y
      : 50;

  const y = clamp(rawY + 18, 0, 100);

  return `${x}% ${y}%`;
}

function TeamStoryModal({
  member,
  open,
  onClose,
}: {
  member: Member | null;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && member ? (
        <motion.div
          className="
            fixed
            inset-0
            z-[99999]
            flex
            items-center
            justify-center
            bg-black/75
            p-4
            backdrop-blur-md
            sm:p-6
          "
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.97,
              y: 18,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.97,
              y: 18,
            }}
            transition={{
              duration: 0.22,
              ease: "easeOut",
            }}
            onClick={(event) => event.stopPropagation()}
            className="
              relative
              max-h-[90vh]
              w-full
              max-w-3xl
              overflow-y-auto
              rounded-[28px]
              border
              border-white/50
              bg-white
              p-6
              text-slate-900
              shadow-[0_30px_100px_rgba(15,23,42,0.35)]

              sm:p-8

              dark:border-white/10
              dark:bg-[#0d111a]
              dark:text-white
              dark:shadow-[0_30px_100px_rgba(0,0,0,0.8)]
            "
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-story-title"
          >
            <button
              type="button"
              onClick={onClose}
              className="
                absolute
                right-4
                top-4
                z-20
                flex
                h-11
                w-11
                items-center
                justify-center
                rounded-full
                border
                border-slate-200
                bg-white
                text-slate-700
                shadow-sm
                transition
                hover:bg-slate-100

                dark:border-white/10
                dark:bg-white/[0.06]
                dark:text-white
                dark:hover:bg-white/[0.12]
              "
              aria-label="Close story"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div
                className="
                  relative
                  h-28
                  w-28
                  overflow-hidden
                  rounded-full
                  border-4
                  border-white
                  shadow-xl
                  ring-4
                  ring-pink-100

                  dark:border-[#0d111a]
                  dark:ring-white/10
                "
              >
                <Image
                  src={member.image_url || "/image/Logo.png"}
                  alt={member.full_name}
                  fill
                  unoptimized
                  sizes="112px"
                  style={{
                    objectFit: "cover",
                    objectPosition: getImagePosition(member),
                  }}
                />
              </div>

              <p
                className="
                  mt-5
                  text-xs
                  font-black
                  uppercase
                  tracking-[0.16em]
                  text-purple-700

                  dark:text-purple-300
                "
              >
                {member.section_title}
              </p>

              <h2
                id="team-story-title"
                className="
                  mt-2
                  text-3xl
                  font-black
                  text-slate-950

                  sm:text-4xl

                  dark:text-white
                "
              >
                {member.full_name}
              </h2>

              <p
                className="
                  mt-2
                  text-base
                  font-semibold
                  text-slate-600

                  dark:text-white/70
                "
              >
                {member.role}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {member.pronouns ? (
                  <span
                    className="
                      rounded-full
                      bg-pink-50
                      px-4
                      py-2
                      text-sm
                      font-bold
                      text-pink-700

                      dark:bg-pink-500/10
                      dark:text-pink-300
                    "
                  >
                    {member.pronouns}
                  </span>
                ) : null}
              </div>

              {member.email ? (
                <a
                  href={`mailto:${member.email}`}
                  className="
                    mt-5
                    inline-flex
                    items-center
                    gap-2
                    rounded-full
                    border
                    border-slate-200
                    bg-slate-50
                    px-5
                    py-3
                    text-sm
                    font-bold
                    text-slate-700
                    transition
                    hover:bg-slate-100

                    dark:border-white/10
                    dark:bg-white/[0.05]
                    dark:text-white
                    dark:hover:bg-white/[0.1]
                  "
                >
                  <Mail className="h-4 w-4" />
                  {member.email}
                </a>
              ) : null}

              {member.story_title ? (
                <h3
                  className="
                    mt-8
                    text-2xl
                    font-black
                    text-slate-950

                    dark:text-white
                  "
                >
                  {member.story_title}
                </h3>
              ) : null}
            </div>

            <div
              className="
                mt-6
                space-y-5
                text-base
                leading-8
                text-slate-700

                sm:text-lg

                dark:text-white/80
              "
            >
              {(member.story ?? "")
                .split("\n")
                .filter((paragraph) => paragraph.trim())
                .map((paragraph, index) => (
                  <p key={`${member.id}-story-${index}`}>
                    {paragraph}
                  </p>
                ))}

              {!member.story?.trim() ? (
                <p className="italic text-slate-500 dark:text-white/50">
                  Story coming soon.
                </p>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CardButtons({
  member,
  onOpenStory,
}: {
  member: Member;
  onOpenStory: (member: Member) => void;
}) {
  const hasStory = Boolean(member.story?.trim());

  return (
    <div
      className="
        mt-auto
        grid
        gap-3
        pt-5

        sm:grid-cols-2
      "
    >
      <Link
        href={`/team/${slugifyName(member.full_name)}`}
        className="
          inline-flex
          min-h-11
          items-center
          justify-center
          rounded-full
          border
          border-slate-200
          bg-white
          px-5
          py-3
          text-sm
          font-black
          text-slate-800
          shadow-sm
          transition
          hover:bg-slate-50

          dark:border-white/10
          dark:bg-white/[0.05]
          dark:text-white
          dark:hover:bg-white/[0.1]
        "
      >
        View Profile
      </Link>

      {hasStory ? (
        <button
          type="button"
          onClick={() => onOpenStory(member)}
          className="
            inline-flex
            min-h-11
            items-center
            justify-center
            gap-2
            rounded-full
            bg-purple-600
            px-5
            py-3
            text-sm
            font-black
            text-white
            shadow-lg
            transition
            hover:bg-purple-500

            dark:bg-purple-500
            dark:hover:bg-purple-400
          "
        >
          <MessageCircleMore className="h-4 w-4" />
          Read Story
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="
            inline-flex
            min-h-11
            cursor-not-allowed
            items-center
            justify-center
            rounded-full
            border
            border-slate-200
            bg-slate-100
            px-5
            py-3
            text-sm
            font-bold
            text-slate-400

            dark:border-white/10
            dark:bg-white/[0.03]
            dark:text-white/30
          "
        >
          Story Coming Soon
        </button>
      )}
    </div>
  );
}

function CommitteeMemberCard({
  member,
  index,
  onOpenStory,
}: {
  member: Member;
  index: number;
  onOpenStory: (member: Member) => void;
}) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{
        once: true,
        amount: 0.18,
      }}
      variants={fadeUp}
      className="h-full"
    >
      <article
        className="
          group
          flex
          h-full
          flex-col
          overflow-hidden
          rounded-[28px]
          border
          border-white/60
          bg-white/90
          text-slate-950
          shadow-[0_18px_50px_rgba(15,23,42,0.12)]
          backdrop-blur-md
          transition
          duration-300
          hover:-translate-y-1
          hover:shadow-[0_24px_70px_rgba(15,23,42,0.18)]

          dark:border-white/10
          dark:bg-[#111827]/90
          dark:text-white
          dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]
        "
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-200 dark:bg-[#090d14]">
          <Image
            src={member.image_url || "/image/Logo.png"}
            alt={member.full_name}
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            style={{
              objectFit: "cover",
              objectPosition: getImagePosition(member),
            }}
            className="transition duration-500 group-hover:scale-[1.03]"
          />

          <div
            className="
              absolute
              inset-x-0
              bottom-0
              h-24
              bg-gradient-to-t
              from-black/60
              to-transparent
            "
          />

          <div
            className="
              absolute
              bottom-4
              left-4
              right-4
              flex
              items-end
              justify-between
              gap-3
            "
          >
            <span
              className="
                rounded-full
                bg-white/90
                px-3
                py-1.5
                text-xs
                font-black
                text-purple-700
                shadow-md
                backdrop-blur

                dark:bg-black/60
                dark:text-purple-200
              "
            >
              {member.section_title}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-6">
          <h3
            className="
              text-2xl
              font-black
              leading-tight
              text-slate-950

              dark:text-white
            "
          >
            {member.full_name}
          </h3>

          <p
            className="
              mt-2
              text-base
              font-bold
              text-purple-700

              dark:text-purple-300
            "
          >
            {member.role}
          </p>

          {member.pronouns ? (
            <div className="mt-4">
              <span
                className="
                  inline-flex
                  rounded-full
                  bg-pink-50
                  px-3
                  py-1.5
                  text-xs
                  font-bold
                  text-pink-700

                  dark:bg-pink-500/10
                  dark:text-pink-300
                "
              >
                {member.pronouns}
              </span>
            </div>
          ) : null}

          {member.email ? (
            <a
              href={`mailto:${member.email}`}
              className="
                mt-4
                inline-flex
                w-fit
                max-w-full
                items-center
                gap-2
                rounded-full
                border
                border-slate-200
                bg-slate-50
                px-4
                py-2.5
                text-sm
                font-semibold
                text-slate-700
                transition
                hover:bg-slate-100

                dark:border-white/10
                dark:bg-white/[0.05]
                dark:text-white/80
                dark:hover:bg-white/[0.1]
              "
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{member.email}</span>
            </a>
          ) : null}

          <CardButtons
            member={member}
            onOpenStory={onOpenStory}
          />
        </div>
      </article>
    </motion.div>
  );
}

export default function MeetUsContent() {
  const prefersReducedMotion = useReducedMotion();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStoryMember, setActiveStoryMember] =
    useState<Member | null>(null);

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

        const data =
          (await response.json()) as CommitteeApiResponse;

        if (!response.ok || !data.ok) {
          throw new Error(
            data.error || "Failed to load committee members",
          );
        }

        setMembers(
          (data.members ?? []).filter(
            (member) => member.is_published,
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
            : "Failed to load members",
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

  const sections = useMemo<Section[]>(() => {
    const grouped = new Map<string, Member[]>();

    for (const member of members) {
      const title =
        member.section_title?.trim() || "Committee";

      const existingMembers = grouped.get(title) ?? [];

      grouped.set(title, [...existingMembers, member]);
    }

    return Array.from(grouped.entries()).map(
      ([title, groupedMembers]) => ({
        title,
        members: [...groupedMembers].sort(
          (firstMember, secondMember) =>
            (firstMember.display_order ?? 999) -
            (secondMember.display_order ?? 999),
        ),
      }),
    );
  }, [members]);

  const boardSection = sections.find(
    (section) => section.title === "Committed Board",
  );

  const otherSections = sections.filter(
    (section) => section.title !== "Committed Board",
  );

  const totalMembers = members.length;

  return (
    <>
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
        <div className="mx-auto max-w-7xl">
          {/* HERO */}
          <motion.header
            initial={
              prefersReducedMotion
                ? false
                : {
                    opacity: 0,
                    y: 20,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.55,
              ease: "easeOut",
            }}
            className="
              grid
              gap-8
              rounded-[32px]
              border
              border-white/60
              bg-white/85
              p-6
              shadow-xl
              backdrop-blur-md

              sm:p-8

              lg:grid-cols-[0.75fr_1.25fr]
              lg:items-center
              lg:p-10

              dark:border-white/10
              dark:bg-[#111827]/90
              dark:shadow-black/30
            "
          >
            <div className="flex justify-center lg:justify-start">
              <div
                className="
                  relative
                  h-40
                  w-40
                  overflow-hidden
                  rounded-full
                  border-4
                  border-white
                  shadow-2xl
                  ring-8
                  ring-pink-100

                  sm:h-48
                  sm:w-48

                  dark:border-[#111827]
                  dark:ring-white/10
                "
              >
                <Image
                  src="/image/Logo.png"
                  alt="Burton Pride Team"
                  fill
                  priority
                  className="object-cover"
                />
              </div>
            </div>

            <div className="text-center lg:text-left">
              <p
                className="
                  text-sm
                  font-black
                  uppercase
                  tracking-[0.18em]
                  text-purple-700

                  dark:text-purple-300
                "
              >
                The people behind Burton Pride
              </p>

              <h1
                className="
                  mt-3
                  text-4xl
                  font-black
                  leading-tight
                  text-slate-950

                  sm:text-5xl
                  lg:text-6xl

                  dark:text-white
                "
              >
                Meet the Burton Pride Team
              </h1>

              <p
                className="
                  mt-5
                  max-w-3xl
                  text-base
                  leading-7
                  text-slate-700

                  sm:text-lg
                  sm:leading-8

                  dark:text-white/75
                "
              >
                Burton Pride is run by local people who care about the
                community. Meet the team, find out what everyone does, and read
                the stories behind the people helping to keep Pride moving.
              </p>

              {!loading && !error && totalMembers > 0 ? (
                <div
                  className="
                    mt-6
                    inline-flex
                    items-center
                    gap-2
                    rounded-full
                    bg-purple-50
                    px-4
                    py-2
                    text-sm
                    font-black
                    text-purple-700

                    dark:bg-purple-500/10
                    dark:text-purple-300
                  "
                >
                  <UsersRound className="h-4 w-4" />
                  {totalMembers} team {totalMembers === 1 ? "member" : "members"}
                </div>
              ) : null}
            </div>
          </motion.header>

          {/* SMALL INTRO NOTE */}
          <motion.section
            initial={
              prefersReducedMotion
                ? false
                : {
                    opacity: 0,
                    y: 18,
                  }
            }
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{ once: true }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.5,
            }}
            className="
              mt-8
              flex
              items-start
              gap-4
              rounded-3xl
              border
              border-white/50
              bg-white/70
              p-5
              shadow-sm
              backdrop-blur-md

              sm:p-6

              dark:border-white/10
              dark:bg-white/[0.04]
            "
          >
            <div
              className="
                mt-0.5
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-2xl
                bg-yellow-100
                text-yellow-700

                dark:bg-yellow-300/10
                dark:text-yellow-300
              "
            >
              <Sparkles className="h-5 w-5" />
            </div>

            <p
              className="
                text-sm
                leading-6
                text-slate-700

                sm:text-base

                dark:text-white/70
              "
            >
              We&apos;re a grassroots team, so everyone brings something
              different. Some people focus on events, others on community work,
              planning, fundraising, or keeping things running behind the scenes.
            </p>
          </motion.section>

          {loading ? (
            <div
              className="
                mt-10
                rounded-3xl
                border
                border-white/50
                bg-white/80
                px-6
                py-8
                text-center
                text-base
                font-semibold
                text-slate-700
                shadow-sm

                dark:border-white/10
                dark:bg-[#111827]/80
                dark:text-white/70
              "
              role="status"
            >
              Loading team members...
            </div>
          ) : null}

          {error ? (
            <div
              className="
                mt-10
                rounded-3xl
                border
                border-red-200
                bg-red-50
                px-6
                py-6
                text-center
                text-base
                font-semibold
                text-red-700

                dark:border-red-500/20
                dark:bg-red-950/30
                dark:text-red-200
              "
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {!loading && !error && boardSection ? (
            <section className="mt-14">
              <div className="mb-7">
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
                  Leadership
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
                  {boardSection.title}
                </h2>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {boardSection.members.map(
                  (member, index) => (
                    <CommitteeMemberCard
                      key={member.id}
                      member={member}
                      index={index}
                      onOpenStory={setActiveStoryMember}
                    />
                  ),
                )}
              </div>
            </section>
          ) : null}

          {!loading && !error
            ? otherSections.map((section, sectionIndex) => (
                <section
                  key={`${section.title}-${sectionIndex}`}
                  className="mt-16"
                >
                  <div className="mb-7">
                    <h2
                      className="
                        text-3xl
                        font-black
                        text-slate-950

                        sm:text-4xl

                        dark:text-white
                      "
                    >
                      {section.title}
                    </h2>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {section.members.map(
                      (member, index) => (
                        <CommitteeMemberCard
                          key={member.id}
                          member={member}
                          index={index + 100}
                          onOpenStory={setActiveStoryMember}
                        />
                      ),
                    )}
                  </div>
                </section>
              ))
            : null}

          {!loading && !error && sections.length === 0 ? (
            <div
              className="
                mt-14
                rounded-3xl
                border
                border-white/50
                bg-white/80
                px-6
                py-10
                text-center
                text-base
                text-slate-700

                dark:border-white/10
                dark:bg-[#111827]/80
                dark:text-white/70
              "
            >
              No published team members are currently available.
            </div>
          ) : null}

          {/* CONTACT CTA */}
          <motion.section
            initial={
              prefersReducedMotion
                ? false
                : {
                    opacity: 0,
                    y: 20,
                  }
            }
            whileInView={{
              opacity: 1,
              y: 0,
            }}
            viewport={{ once: true }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.5,
            }}
            className="
              relative
              mt-16
              overflow-hidden
              rounded-[30px]
              bg-gradient-to-r
              from-pink-500
              via-purple-600
              to-blue-600
              px-6
              py-10
              text-center
              text-white
              shadow-2xl

              sm:px-10
              sm:py-12
            "
          >
            <div
              aria-hidden="true"
              className="
                pointer-events-none
                absolute
                -left-20
                -top-20
                h-56
                w-56
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
                -bottom-20
                -right-20
                h-64
                w-64
                rounded-full
                bg-blue-300/20
                blur-3xl
              "
            />

            <div className="relative">
              <h2
                className="
                  text-3xl
                  font-black

                  sm:text-4xl
                "
              >
                Want to talk to the team?
              </h2>

              <p
                className="
                  mx-auto
                  mt-4
                  max-w-2xl
                  text-base
                  leading-7
                  text-white/90

                  sm:text-lg
                "
              >
                Get in touch about volunteering, collaborations, sponsorship,
                community projects or anything else you&apos;d like to speak to
                Burton Pride about.
              </p>

              <Link
                href="/ContactUS"
                className="
                  mt-7
                  inline-flex
                  min-h-12
                  items-center
                  justify-center
                  rounded-full
                  bg-yellow-300
                  px-7
                  py-3
                  text-sm
                  font-black
                  text-purple-950
                  shadow-xl
                  transition
                  hover:scale-105
                  hover:bg-white
                "
              >
                Contact Burton Pride
              </Link>
            </div>
          </motion.section>
        </div>
      </main>

      <TeamStoryModal
        member={activeStoryMember}
        open={Boolean(activeStoryMember)}
        onClose={() => setActiveStoryMember(null)}
      />
    </>
  );
}
