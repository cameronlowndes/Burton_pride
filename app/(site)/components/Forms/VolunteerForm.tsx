"use client";

import { useState } from "react";

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  availability: string[];
  experience: string;
  why_volunteer: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
};

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const initialForm: FormState = {
  full_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  availability: [],
  experience: "",
  why_volunteer: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
};

export default function VolunteerForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(day: string) {
    setForm((prev) => ({
      ...prev,
      availability: prev.availability.includes(day)
        ? prev.availability.filter((d) => d !== day)
        : [...prev.availability, day],
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/volunteer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          availability: form.availability.join(", "),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to submit volunteer form");
      }

      setSuccess("Thank you. Your volunteer form has been sent.");
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-xl rounded-2xl bg-white/20 p-6 shadow-lg backdrop-blur-md"
    >
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Full name"
          value={form.full_name}
          onChange={(e) => updateField("full_name", e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/70 outline-none"
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/70 outline-none"
          required
        />

        <input
          type="text"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => updateField("phone", e.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/70 outline-none"
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-white/90">
            Date of birth
          </label>
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => updateField("date_of_birth", e.target.value)}
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white outline-none"
            required
          />
        </div>

        <div className="rounded-lg border border-white/20 bg-white/10 px-4 py-4 text-white">
          <p className="mb-3 text-sm font-semibold text-white/90">
            Availability - select days
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DAYS.map((day) => {
              const active = form.availability.includes(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    active
                      ? "border-yellow-300 bg-yellow-400 text-black"
                      : "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-white/20 bg-white/10 px-4 py-4">
          <p className="mb-3 text-sm font-semibold text-white/90">
            Emergency Contact
          </p>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Emergency contact name"
              value={form.emergency_contact_name}
              onChange={(e) => updateField("emergency_contact_name", e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/70 outline-none"
              required
            />

            <input
              type="text"
              placeholder="Emergency contact phone"
              value={form.emergency_contact_phone}
              onChange={(e) => updateField("emergency_contact_phone", e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/70 outline-none"
              required
            />

            <input
              type="text"
              placeholder="Relationship to you"
              value={form.emergency_contact_relationship}
              onChange={(e) =>
                updateField("emergency_contact_relationship", e.target.value)
              }
              className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/70 outline-none"
              required
            />
          </div>
        </div>

        <textarea
          placeholder="Relevant experience"
          value={form.experience}
          onChange={(e) => updateField("experience", e.target.value)}
          className="min-h-[110px] w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/70 outline-none"
        />

        <textarea
          placeholder="Why do you want to volunteer?"
          value={form.why_volunteer}
          onChange={(e) => updateField("why_volunteer", e.target.value)}
          className="min-h-[140px] w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/70 outline-none"
          required
        />

        {error ? (
          <div className="rounded-lg border border-red-300/30 bg-red-500/20 px-4 py-3 text-sm text-white">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-lg border border-green-300/30 bg-green-500/20 px-4 py-3 text-sm text-white">
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-yellow-400 px-4 py-3 font-semibold text-black transition hover:bg-yellow-300 disabled:opacity-60"
        >
          {loading ? "Sending..." : "Submit Volunteer Form"}
        </button>
      </div>
    </form>
  );
}