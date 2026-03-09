// app/Forms/MessageForm.tsx
"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";

type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export default function MessageForm() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          subject: form.subject,
          message: form.message,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSuccess(data?.message || "Your message has been sent.");
      setForm({
        name: "",
        email: "",
        subject: "",
        message: "",
      });
    } catch (err) {
      console.error("Contact form submit error:", err);
      setError("Could not send your message. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl bg-white/15 backdrop-blur-md border border-white/20 shadow-2xl p-6 sm:p-8 flex flex-col gap-5"
    >
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-semibold text-white">
          Name
        </label>
        <input
          id="name"
          type="text"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="Your name"
          required
          className="w-full rounded-2xl border border-white/20 bg-white/90 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-pink-400"
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-semibold text-white">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full rounded-2xl border border-white/20 bg-white/90 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-pink-400"
        />
      </div>

      <div>
        <label htmlFor="subject" className="mb-2 block text-sm font-semibold text-white">
          Subject
        </label>
        <input
          id="subject"
          type="text"
          value={form.subject}
          onChange={(e) => updateField("subject", e.target.value)}
          placeholder="What is this about?"
          className="w-full rounded-2xl border border-white/20 bg-white/90 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-pink-400"
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-2 block text-sm font-semibold text-white">
          Message
        </label>
        <textarea
          id="message"
          value={form.message}
          onChange={(e) => updateField("message", e.target.value)}
          placeholder="Write your message here..."
          required
          rows={6}
          className="w-full rounded-2xl border border-white/20 bg-white/90 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-pink-400"
        />
      </div>

      {success && (
        <div className="rounded-2xl bg-green-500/20 border border-green-300/40 px-4 py-3 text-white">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-500/20 border border-red-300/40 px-4 py-3 text-white">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-2xl bg-white text-pink-600 font-bold px-6 py-3 shadow-lg hover:bg-gray-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? "Sending..." : "Send Message"}
      </button>
    </motion.form>
  );
}