import React from "react";
import { useForm, ValidationError } from "@formspree/react";

export default function ContactForm() {
  const [state, handleSubmit] = useForm("xyzpqnrq");

  if (state.succeeded) {
    return (
      <p className="text-green-400 font-semibold text-lg mt-4 text-center">
        Thanks for reaching out! We will get back to you soon.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-md mx-auto p-8 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white rounded-3xl shadow-2xl border-4 border-white/30 flex flex-col gap-6"
    >
      <h2 className="text-2xl font-bold mb-4 text-white drop-shadow-md">Contact Us</h2>

      <label htmlFor="name" className="font-medium">Name</label>
      <input
        id="name"
        type="text"
        name="name"
        placeholder="Your Name"
        required
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-pink-300"
      />

      <label htmlFor="email" className="font-medium">Email Address</label>
      <input
        id="email"
        type="email"
        name="email"
        placeholder="your@email.com"
        required
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-purple-300"
      />
      <ValidationError prefix="Email" field="email" errors={state.errors} className="text-yellow-300" />

      <label htmlFor="message" className="font-medium">Message</label>
      <textarea
        id="message"
        name="message"
        placeholder="Write your message here..."
        required
        rows={5}
        className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      <ValidationError prefix="Message" field="message" errors={state.errors} className="text-yellow-300" />

      <button
        type="submit"
        disabled={state.submitting}
        className="bg-white text-pink-600 font-bold py-3 px-6 rounded-lg hover:bg-white/90 transition transform hover:scale-105 shadow-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        Send Message
      </button>
    </form>
  );
}
