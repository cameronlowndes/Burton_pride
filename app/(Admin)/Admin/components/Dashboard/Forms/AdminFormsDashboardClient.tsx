"use client";

import Link from "next/link";
import { useMemo } from "react";

type FormLink = {
  key: string;
  title: string;
  desc: string;
  href: string;
  adminHref?: string;
  badge?: string;
};

export default function AdminFormsDashboardClient() {
  const forms = useMemo<FormLink[]>(
    () => [
      {
        key: "contact",
        title: "Contact form",
        desc: "Messages sent from the Contact Us page.",
        href: "/ContactUS",
        adminHref: "/Admin/Dashboard/Forms/Contact",
        badge: "Live",
      },
      {
        key: "join",
        title: "Volunteer interest",
        desc: "Volunteer sign-up form responses.",
        href: "/JoinUS/Volunteer",
        adminHref: "/Admin/Dashboard/Forms/Volunteer",
        badge: "Live",
      },
      {
        key: "sponsors",
        title: "Sponsor enquiry",
        desc: "Sponsor signup / enquiries form.",
        href: "/Collaborate",
        adminHref: "/Admin/Dashboard/Forms/Sponsors",
        badge: "Live",
      },
      {
        key: "windows",
        title: "Windows of Hope entry",
        desc: "Competition entry submissions.",
        href: "/competition",
        adminHref: "/Admin/Dashboard/Windows-showcase/Votes",
        badge: "Live",
      },
      {
        key: "feedback",
        title: "Feedback form",
        desc: "General feedback submissions.",
        href: "/FeedBack",
        adminHref: "/Admin/Dashboard/Forms/Feedback",
        badge: "Live",
      },
    ],
    [],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Forms</h1>
          <p className="text-white/80">
            Quick access to every website form and its responses.
          </p>
        </div>

        <Link
          href="/Admin/Dashboard"
          className="w-fit rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
        >
          Back to dashboard
        </Link>
      </div>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {forms.map((form) => (
          <Card key={form.key}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold">{form.title}</div>
                <div className="mt-1 text-sm text-white/75">{form.desc}</div>
              </div>

              {form.badge ? (
                <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
                  {form.badge}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3">
              <Link
                href={form.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-black/30"
              >
                <div className="font-extrabold">Open form</div>
                <div className="mt-1 break-all text-xs text-white/60">
                  {form.href}
                </div>
              </Link>

              {form.adminHref ? (
                <Link
                  href={form.adminHref}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:bg-black/30"
                >
                  <div className="font-extrabold">View responses</div>
                  <div className="mt-1 break-all text-xs text-white/60">
                    {form.adminHref}
                  </div>
                </Link>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 opacity-60">
                  <div className="font-extrabold">View responses</div>
                  <div className="mt-1 text-xs text-white/60">
                    Not connected yet
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </section>

      <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="font-extrabold">Forms dashboard</div>
        <p className="mt-2 text-sm text-white/75">
          Use the public form links to test submissions and the admin links to
          review responses.
        </p>
      </div>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}