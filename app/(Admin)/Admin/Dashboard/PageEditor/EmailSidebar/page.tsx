import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Mail, ShieldAlert } from "lucide-react";
import EmailSidebarAdminClient from "./EmailSidebarAdminClient";
import { requireMainAdmin } from "@/lib/isMainAdmin";

export default async function EmailSidebarPage() {
  const { userId } = await auth();

  // ❌ Not logged in
  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Please sign in</h1>
          <Link href="/Admin/Login" className="mt-4 inline-block">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  // ❌ Not main admin
  try {
    await requireMainAdmin();
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <div className="w-full max-w-2xl rounded-[36px] bg-white/10 backdrop-blur-2xl p-8">
          <h1 className="text-3xl font-bold">Main admin only</h1>

          <p className="mt-4 text-white/80">
            This page is restricted to the main admin.
          </p>

          <div className="mt-6 flex gap-3">
            <Link href="/Admin/Dashboard">Back</Link>
            <a href="mailto:info@burtonpride.co.uk">Contact team</a>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Allowed
  return <EmailSidebarAdminClient />;
}