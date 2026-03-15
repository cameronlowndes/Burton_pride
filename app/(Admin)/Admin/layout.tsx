"use client";

import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AdminSidebar from "./components/rooting/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isLoginPage = pathname === "/Admin/Login";
  const isDashboardRoute = pathname?.startsWith("/Admin/Dashboard");
  const showAdminNav = !isLoginPage && isDashboardRoute;

  const { user, isLoaded } = useUser();

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Committee Member";

  return (
    <div className="min-h-screen text-white bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500">
      {/* ✅ column on mobile, row on desktop */}
      <div className="flex flex-col md:flex-row min-h-screen">
        {/* Sidebar / Mobile top nav */}
        {showAdminNav && <AdminSidebar />}

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop header only */}
          {showAdminNav && (
            <header className="hidden md:flex h-16 bg-white/10 backdrop-blur-xl items-center justify-between px-8 shadow-sm">
              <div className="font-semibold text-white/90">Admin Portal</div>

              <div className="text-sm text-white/80">
                Signed in as{" "}
                <span className="font-semibold">
                  {isLoaded ? displayName : "Loading..."}
                </span>
              </div>
            </header>
          )}

          <main className="flex-1 px-4 md:px-8 py-6 md:py-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}