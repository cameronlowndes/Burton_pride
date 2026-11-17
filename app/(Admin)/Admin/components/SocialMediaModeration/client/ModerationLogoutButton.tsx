"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/supabaseClient";
export default function ModerationLogoutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/settings/logout", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Logout could not be completed. Please try again.");
      await supabase.auth.signOut({ scope: "local" });
      window.location.replace("/Admin/Login?loggedOut=1");
    } catch (error) { setError(error instanceof Error ? error.message : "Logout failed. Try again."); setBusy(false); }
  }
  return <div><button type="button" onClick={() => void logout()} disabled={busy} className="min-h-11 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:opacity-60">{busy ? "Logging out…" : "Log out"}</button>{error ? <p role="alert" className="mt-2 text-sm text-amber-200">{error}</p> : null}</div>;
}
