import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-10 text-white">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-2xl p-6">
        <h1 className="text-2xl font-extrabold">Admin page not found</h1>
        <p className="mt-2 text-white/70">
          That admin page doesn’t exist.
        </p>
        <div className="mt-5 flex gap-3">
          <Link
            href="/admin"
            className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition"
          >
            Back to dashboard
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
          >
            Back to website
          </Link>
        </div>
      </div>
    </div>
  );
}
