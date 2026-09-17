"use client";

import { useEffect, useState } from "react";
import { Loader2, Radio, Save } from "lucide-react";

type Settings = {
  status: "not_started" | "live" | "paused" | "completed";
  broadcast_mode: "facebook_live" | "in_person" | "results_only";
  facebook_live_url: string | null;
  public_message: string | null;
};

export default function LiveDrawSettingsPanel({ lotteryId }: { lotteryId: string }) {
  const [settings, setSettings] = useState<Settings>({ status: "not_started", broadcast_mode: "in_person", facebook_live_url: null, public_message: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/lotterymanagement/lottery/${lotteryId}/live-draw`, { credentials: "include" })
      .then((response) => response.json())
      .then((data) => { if (data.ok) setSettings(data.settings); else setMessage(data.error || "Unable to load settings."); })
      .catch(() => setMessage("Unable to load settings."))
      .finally(() => setLoading(false));
  }, [lotteryId]);

  async function save() {
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/lotterymanagement/lottery/${lotteryId}/live-draw`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to save settings.");
      setSettings(data.settings); setMessage("Live draw page updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save settings."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center gap-2 text-sm text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> Loading live draw settings…</div>;

  return <section className="rounded-3xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-5">
    <div className="flex items-center gap-3"><div className="rounded-2xl bg-fuchsia-500/20 p-3 text-fuchsia-100"><Radio className="h-5 w-5" /></div><div><h2 className="font-black text-white">Public live draw page</h2><p className="text-sm text-white/60">Choose whether this draw is on Facebook Live, in person, or results only.</p></div></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="text-sm font-bold text-white">Draw status<select value={settings.status} onChange={(e) => setSettings((value) => ({ ...value, status: e.target.value as Settings["status"] }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#15172a] px-3 py-3 text-white"><option value="not_started">Not started</option><option value="live">Live now</option><option value="paused">Paused</option><option value="completed">Completed</option></select></label>
      <label className="text-sm font-bold text-white">How people follow the draw<select value={settings.broadcast_mode} onChange={(e) => setSettings((value) => ({ ...value, broadcast_mode: e.target.value as Settings["broadcast_mode"] }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#15172a] px-3 py-3 text-white"><option value="in_person">In person — publish results as they are confirmed</option><option value="facebook_live">Facebook Live video</option><option value="results_only">Results only</option></select></label>
    </div>
    {settings.broadcast_mode === "facebook_live" ? <label className="mt-4 block text-sm font-bold text-white">Facebook Live URL<input value={settings.facebook_live_url || ""} onChange={(e) => setSettings((value) => ({ ...value, facebook_live_url: e.target.value }))} placeholder="https://www.facebook.com/..." className="mt-2 w-full rounded-xl border border-white/10 bg-[#15172a] px-3 py-3 text-white" /></label> : null}
    <label className="mt-4 block text-sm font-bold text-white">Public message<textarea value={settings.public_message || ""} onChange={(e) => setSettings((value) => ({ ...value, public_message: e.target.value }))} placeholder="The draw is taking place now. Winners will appear here shortly." className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-[#15172a] px-3 py-3 text-white" /></label>
    {message ? <p className="mt-4 text-sm text-white/75">{message}</p> : null}
    <button type="button" onClick={() => void save()} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-black disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save live draw settings</button>
  </section>;
}
