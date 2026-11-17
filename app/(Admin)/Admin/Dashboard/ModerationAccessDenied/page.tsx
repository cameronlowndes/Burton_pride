import Link from "next/link";
export const dynamic = "force-dynamic";
export default function ModerationAccessDeniedPage() {
  return <main className="mx-auto max-w-2xl space-y-4 p-6 text-white">
    <h1 className="text-2xl font-bold">Moderation access is restricted</h1>
    <p>Your account needs the moderation permission for this screen and an active AAL2 session on a trusted device.</p>
    <p>Ask a Main Admin to check your access, or sign in again if your device or session was revoked.</p>
    <div className="flex gap-4"><Link className="underline" href="/Admin/Dashboard">Admin Portal</Link><Link className="underline" href="/Admin/Login">Sign in again</Link></div>
  </main>;
}
