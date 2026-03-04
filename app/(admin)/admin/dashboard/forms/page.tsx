"use client";

import Link from "next/link";
import { useMemo } from "react";

type FormLink = {
  key: string;
  title: string;
  desc: string;
  href: string; // where the form lives on the public website
  adminHref?: string; // optional: where you review responses later
  badge?: string;
};

export default function AdminFormsDashboardPage() {
  // ✅ Edit these 5 links to match your real pages
  const forms = useMemo<FormLink[]>(
    () => [
      {
        key: "contact",
        title: "Contact form",
        desc: "Messages sent from the Contact Us page.",
        href: "/ContactUS",
        adminHref: "/admin/dashboard/forms/contact",
        badge: "Live",
      },
      {
        key: "join",
        title: "Volunteer interest",
        desc: "Volunteer sign-up form responses.",
        href: "/JoinUS/Volunteer",
        adminHref: "/admin/dashboard/forms/join-the-team",
        badge: "Live",
      },
      {
        key: "sponsors",
        title: "Sponsor enquiry",
        desc: "Sponsor signup / enquiries form.",
        href: "/Collaborate",
        adminHref: "/admin/dashboard/forms/sponsors",
        badge: "Live",
      },
      {
        key: "windows",
        title: "Windows of Hope entry",
        desc: "Competition entry submissions.",
        href: "/competition",
        adminHref: "/admin/dashboard/windows-showcase/votes",
        badge: "Live",
      },
      {
        key: "stalls",
        title: "Stalls / Traders form",
        desc: "Stallholder booking / trader applications.",
        href: "/meet-us",
        adminHref: "/admin/dashboard/forms/stalls",
        badge: "Coming soon",
      },
    ],
    []
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">Forms</h1>
          <p className="text-white/80">
            Quick access to every website form and (later) the responses.
          </p>
        </div>

        <Link
          href="/admin/dashboard"
          className="rounded-2xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition w-fit"
        >
          Back to dashboard
        </Link>
      </div>

      {/* 5 cards */}
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {forms.map((f) => (
          <Card key={f.key}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold">{f.title}</div>
                <div className="text-sm text-white/75 mt-1">{f.desc}</div>
              </div>

              {f.badge && (
                <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/80">
                  {f.badge}
                </span>
              )}
            </div>

            <div className="mt-5 grid gap-3">
              <Link
                href={f.href}
                target="_blank"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 hover:bg-black/30 transition"
              >
                <div className="font-extrabold">Open form</div>
                <div className="text-xs text-white/60 mt-1">{f.href}</div>
              </Link>

              {f.adminHref ? (
                <Link
                  href={f.adminHref}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 hover:bg-black/30 transition"
                >
                  <div className="font-extrabold">View responses</div>
                  <div className="text-xs text-white/60 mt-1">{f.adminHref}</div>
                </Link>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 opacity-60">
                  <div className="font-extrabold">View responses</div>
                  <div className="text-xs text-white/60 mt-1">
                    Not connected yet
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </section>

      {/* Tip */}
      <div className="rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-xl p-6">
        <div className="font-extrabold">Tip</div>
        <p className="text-sm text-white/75 mt-2">
          If your form URLs are different, just edit the <span className="font-semibold">href</span>{" "}
          values at the top of this file.
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
        "rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-xl p-6",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}