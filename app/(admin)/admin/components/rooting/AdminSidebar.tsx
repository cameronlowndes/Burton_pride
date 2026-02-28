"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";

export default function AdminSidebar() {
  const { signOut } = useClerk();

  return (
    <aside className="relative w-72 bg-white/10 backdrop-blur-xl shadow-xl">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-11 w-11 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-lg">
            BP
          </div>
          <div>
            <div className="text-lg font-extrabold">Burton Pride</div>
            <div className="text-xs text-white/70">Committee Admin</div>
          </div>
        </div>

        <nav className="space-y-2">
          <NavLink href="/admin/dashboard" label="Dashboard" />
          <NavLink href="/admin/dashboard/email" label="Emails" />
          <NavLink href="/admin/dashboard/events" label="Events" />
           <NavLink href="/admin/dashboard/windows-showcase" label="Window Showcase" />

          <div className="pt-6 mt-6 border-t border-white/20">
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/admin/login" })}
              className="group w-full text-left flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition text-white/70 hover:text-white hover:bg-white/10"
            >
              <span>Log out</span>
              <span className="opacity-0 group-hover:opacity-100 transition text-white/70">
                →
              </span>
            </button>
          </div>
        </nav>
      </div>

      <div className="absolute bottom-6 left-6 text-xs text-white/60">
        Burton Pride C.I.C
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  subtle,
}: {
  href: string;
  label: string;
  subtle?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition",
        subtle
          ? "text-white/70 hover:text-white hover:bg-white/10"
          : "text-white hover:bg-white/15",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="opacity-0 group-hover:opacity-100 transition text-white/70">
        →
      </span>
    </Link>
  );
}