"use client";

import React, { useState } from "react";

export default function EntertainmentForm() {
  const [performanceType, setPerformanceType] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setTimeout(() => {
      window.location.href = "/ThankYou";
    }, 100);
  };

  return (
    <form
      action="https://formspree.io/f/xdazwdbq" 
      method="POST"
      className="space-y-4 text-black"
      onSubmit={handleSubmit}
      target="_blank"
    >
      {/* Performance Name */}
      <div>
        <label className="block font-bold mb-1">Performance / Act Name</label>
        <input
          type="text"
          name="performance_name"
          required
          className="w-full p-2 rounded border"
        />
      </div>

      {/* Performer Name / Group Leader */}
      <div>
        <label className="block font-bold mb-1">Performer Name / Group Leader</label>
        <input
          type="text"
          name="performer_name"
          required
          className="w-full p-2 rounded border"
        />
      </div>

      {/* Contact Email */}
      <div>
        <label className="block font-bold mb-1">Email Address</label>
        <input
          type="email"
          name="email"
          required
          className="w-full p-2 rounded border"
        />
      </div>

      {/* Contact Phone */}
      <div>
        <label className="block font-bold mb-1">Phone Number</label>
        <input
          type="tel"
          name="phone"
          className="w-full p-2 rounded border"
        />
      </div>

      {/* Type of Performance */}
      <div>
        <label className="block font-bold mb-1">Type of Performance</label>
        <select
          name="performance_type"
          required
          className="w-full p-2 rounded border"
          value={performanceType}
          onChange={(e) => setPerformanceType(e.target.value)}
        >
          <option value="">Select one</option>
          <option value="Music">Music</option>
          <option value="Dance">Dance</option>
          <option value="Comedy">Comedy / Stand-Up</option>
          <option value="Spoken Word / Poetry">Spoken Word / Poetry</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Video / Media Link */}
      <div>
        <label className="block font-bold mb-1">
          Performance Video / Media Link
        </label>
        <input
          type="url"
          name="performance_link"
          placeholder="YouTube, Vimeo, or other link"
          required
          className="w-full p-2 rounded border"
        />
      </div>

 

      {/* Message / Notes */}
      <div>
        <label className="block font-bold mb-1">Additional Notes / Requests</label>
        <textarea
          name="message"
          rows={4}
          className="w-full p-2 rounded border"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full bg-pink-500 text-white py-3 rounded font-bold hover:bg-pink-400 hover:scale-105 transition-transform cursor-pointer"
      >
        Apply as Entertainment
      </button>
    </form>
  );
}
