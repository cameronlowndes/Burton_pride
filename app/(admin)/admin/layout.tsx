"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "./components/rooting/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isLoginPage = pathname === "/admin/login";
  const isDashboardRoute = pathname?.startsWith("/admin/dashboard");
  const showAdminNav = !isLoginPage && isDashboardRoute;

  return (
    <div className="min-h-screen text-white bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        {showAdminNav && <AdminSidebar />}

        {/* Main */}
        <div className="flex-1 flex flex-col">
          {showAdminNav && (
            <header className="h-16 bg-white/10 backdrop-blur-xl flex items-center justify-between px-8 shadow-sm">
              <div className="font-semibold text-white/90">Admin Portal</div>
              <div className="text-sm text-white/80">
                Signed in as <span className="font-semibold">Committee Member</span>
              </div>
            </header>
          )}

          <main className="flex-1 px-8 py-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
