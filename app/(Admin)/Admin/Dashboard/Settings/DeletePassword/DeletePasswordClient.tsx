"use client";

import { useState } from "react";

export default function DeletePasswordClient() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function updatePassword() {
    setSaving(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/admin/settings/delete-password/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.error || "Failed to update password");
      setSaving(false);
      return;
    }

    setMessage("Password updated successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSaving(false);
  }

  async function resetForgottenPassword() {
    setResetting(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/admin/settings/delete-password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword, confirmPassword: confirmResetPassword }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.error || "Failed to reset password");
      setResetting(false);
      return;
    }

    setMessage("Password reset successfully.");
    setResetPassword("");
    setConfirmResetPassword("");
    setResetting(false);
  }

  return (
    <main className="min-h-screen p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-4xl font-black text-yellow-300">
          Main Admin Delete Password
        </h1>

        {message && <div className="rounded-2xl bg-green-500/20 p-4 font-bold">{message}</div>}
        {error && <div className="rounded-2xl bg-red-500/20 p-4 font-bold">{error}</div>}

        <section className="rounded-3xl bg-white/10 p-6">
          <h2 className="text-2xl font-black text-yellow-300">Update Password</h2>

          <div className="mt-5 space-y-4">
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="w-full rounded-2xl bg-white/10 px-5 py-4 outline-none" />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="w-full rounded-2xl bg-white/10 px-5 py-4 outline-none" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full rounded-2xl bg-white/10 px-5 py-4 outline-none" />

            <button disabled={saving} onClick={updatePassword} className="rounded-full bg-yellow-300 px-6 py-3 font-black text-black">
              {saving ? "Updating..." : "Update Password"}
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-red-300/30 bg-red-500/10 p-6">
          <h2 className="text-2xl font-black text-red-100">Forgot Password Reset</h2>
          <p className="mt-2 text-white/70">Only main admin can use this reset option.</p>

          <div className="mt-5 space-y-4">
            <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="New reset password" className="w-full rounded-2xl bg-white/10 px-5 py-4 outline-none" />
            <input type="password" value={confirmResetPassword} onChange={(e) => setConfirmResetPassword(e.target.value)} placeholder="Confirm reset password" className="w-full rounded-2xl bg-white/10 px-5 py-4 outline-none" />

            <button disabled={resetting} onClick={resetForgottenPassword} className="rounded-full bg-red-500 px-6 py-3 font-black text-white">
              {resetting ? "Resetting..." : "Reset Forgotten Password"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}