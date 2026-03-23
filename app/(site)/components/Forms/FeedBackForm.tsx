'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

type ApiResponse = {
  ok: boolean;
  error?: string;
  message?: string;
};

const emptyForm = {
  name: '',
  email: '',
  message: '',
};

export default function FeedBackForm() {
  const [form, setForm] = useState(emptyForm);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  function updateField(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitState('submitting');
    setError(null);

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setSubmitState('error');
      setError('Please complete all fields before submitting.');
      return;
    }

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          message: form.message.trim(),
        }),
      });

      const text = await res.text();

      let data: ApiResponse = { ok: false, error: 'Unknown error' };

      try {
        data = text ? JSON.parse(text) : { ok: false, error: 'Empty response' };
      } catch {
        throw new Error('Server returned invalid JSON');
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to send feedback');
      }

      setSubmitState('success');
      setShowSuccessToast(true);
      resetForm();

      setTimeout(() => {
        setShowSuccessToast(false);
        setSubmitState('idle');
      }, 4500);
    } catch (err) {
      setSubmitState('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <>
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-6 sm:justify-end sm:pr-6"
          >
            <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-green-300/30 bg-green-600/95 p-4 text-white shadow-2xl backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold">
                  ✓
                </div>

                <div className="flex-1">
                  <h4 className="text-base font-bold">Feedback sent successfully</h4>
                  <p className="mt-1 text-sm text-white/90">
                    Thank you for your feedback. We have received your message.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSuccessToast(false)}
                  className="rounded-md px-2 py-1 text-white/80 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close message"
                >
                  ✕
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={onSubmit} className="relative z-10 flex flex-col gap-6">
        <div>
          <label htmlFor="name" className="mb-2 block font-semibold">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            name="name"
            required
            value={form.name}
            onChange={updateField}
            className="w-full rounded-xl border-2 border-pink-400 bg-white p-4 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block font-semibold">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            value={form.email}
            onChange={updateField}
            className="w-full rounded-xl border-2 border-pink-400 bg-white p-4 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="message" className="mb-2 block font-semibold">
            Your Feedback
          </label>
          <textarea
            id="message"
            name="message"
            rows={6}
            required
            value={form.message}
            onChange={updateField}
            className="w-full rounded-xl border-2 border-purple-400 bg-white p-4 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Share your thoughts about Burton Pride..."
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <motion.button
          type="submit"
          disabled={submitState === 'submitting'}
          whileHover={{ scale: submitState === 'submitting' ? 1 : 1.05 }}
          whileTap={{ scale: submitState === 'submitting' ? 1 : 0.95 }}
          className="rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 font-bold text-white shadow-lg transition-all duration-300 hover:from-pink-400 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitState === 'submitting' ? 'Sending...' : 'Submit Feedback'}
        </motion.button>
      </form>
    </>
  );
}