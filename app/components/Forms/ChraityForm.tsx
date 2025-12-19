"use client";

import React, { useState } from "react";
import { useForm, ValidationError } from "@formspree/react";

export default function CharityForm() {
  const [state, handleSubmit] = useForm("xdankrol"); // your Formspree form ID
  const [orgType, setOrgType] = useState("");

  if (state.succeeded) {
    return (
      <div className="text-center p-6">
        <h2 className="text-2xl font-bold mb-4 text-green-600">Thank you!</h2>
        <p>Thanks for joining Burton Pride as a Charity or C.I.C.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-black">
      {/* Charity / C.I.C Name */}
      <div>
        <label className="block font-bold mb-1">Charity / C.I.C Name</label>
        <input
          type="text"
          name="charity_name"
          required
          className="w-full p-2 rounded border"
        />
      </div>

      {/* Contact Name */}
      <div>
        <label className="block font-bold mb-1">Contact Name</label>
        <input
          type="text"
          name="contact_name"
          required
          className="w-full p-2 rounded border"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block font-bold mb-1">Email Address</label>
        <input
          type="email"
          name="email"
          required
          className="w-full p-2 rounded border"
        />
        <ValidationError prefix="Email" field="email" errors={state.errors} />
      </div>

      {/* Phone */}
      <div>
        <label className="block font-bold mb-1">Phone Number</label>
        <input
          type="tel"
          name="phone"
          className="w-full p-2 rounded border"
        />
      </div>

      {/* Type of Organization */}
      <div>
        <label className="block font-bold mb-1">Type of Organization</label>
        <select
          name="org_type"
          required
          className="w-full p-2 rounded border"
          value={orgType}
          onChange={(e) => setOrgType(e.target.value)}
        >
          <option value="">Select one</option>
          <option value="Charity">Charity</option>
          <option value="C.I.C">C.I.C</option>
        </select>
      </div>

      {/* Optional File Links */}
      <div>
        <label className="block font-bold mb-1">
          Any Documents (e.g., Charity Registration) – paste cloud storage link
        </label>
        <input
          type="url"
          name="document_link"
          placeholder="Paste your file link here"
          className="w-full p-2 rounded border"
        />
      </div>

      {/* Message */}
      <div>
        <label className="block font-bold mb-1">Message / Requirements</label>
        <textarea
          name="message"
          rows={4}
          className="w-full p-2 rounded border"
        />
        <ValidationError prefix="Message" field="message" errors={state.errors} />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={state.submitting}
        className="w-full bg-purple-400 text-white py-3 rounded font-bold hover:bg-purple-300 transition cursor-pointer"
      >
        {state.submitting ? "Submitting..." : "Apply for Burton Pride"}
      </button>
    </form>
  );
}
