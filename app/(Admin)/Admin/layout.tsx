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
  const isEmailRoute = pathname?.startsWith("/Admin/Email");

  const showAdminNav = !isLoginPage && isDashboardRoute;

  const { user, isLoaded } = useUser();

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Committee Member";

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
      <div className="flex min-h-screen flex-col md:flex-row">
        {showAdminNav && <AdminSidebar />}

        <div className="flex min-w-0 flex-1 flex-col">
          {showAdminNav && (
            <header className="hidden h-16 items-center justify-between bg-white/10 px-8 shadow-sm backdrop-blur-xl md:flex">
              <div className="font-semibold text-white/90">Admin Portal</div>

              <div className="text-sm text-white/80">
                Signed in as{" "}
                <span className="font-semibold">
                  {isLoaded ? displayName : "Loading..."}
                </span>
              </div>
            </header>
          )}

          {isEmailRoute ? (
            <main className="flex-1 min-w-0">
              {children}
            </main>
          ) : (
            <main className="flex-1 px-4 py-6 md:px-8 md:py-10">
              <div className="mx-auto max-w-6xl">{children}</div>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}