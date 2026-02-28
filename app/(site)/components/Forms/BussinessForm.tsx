"use client";

import React, { useState } from "react";

export default function BusinessForm() {
  const [stallType, setStallType] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Let the form submit normally
    setTimeout(() => {
      // Redirect after submission
      window.location.href = "/ThankYou";
    }, 100); // small delay to ensure form data is sent
  };

  return (
    <form
      action="https://formspree.io/f/xkowgypl"
      method="POST"
      className="space-y-4 text-black"
      onSubmit={handleSubmit}
      target="_blank" // optional: opens Formspree confirmation in new tab
    >
      {/* Business Name */}
      <div>
        <label className="block font-bold mb-1">Business Name</label>
        <input
          type="text"
          name="business_name"
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

      {/* Stall Type */}
      <div>
        <label className="block font-bold mb-1">Type of Stall</label>
        <select
          name="stall_type"
          required
          className="w-full p-2 rounded border"
          value={stallType}
          onChange={(e) => setStallType(e.target.value)}
        >
          <option value="">Select one</option>
          <option value="Business Stall (£25)">Business Stall (£25)</option>
          <option value="Food Vendor (£95)">Food Vendor (£95)</option>
        </select>
      </div>

      {/* File Links */}
      {stallType === "Business Stall (£25)" && (
        <div>
          <label className="block font-bold mb-1">
            Public Liability Insurance (Cloud Storage Link)
          </label>
          <input
            type="url"
            name="public_liability_link"
            placeholder="Paste your file link here"
            required
            className="w-full p-2 rounded border"
          />
        </div>
      )}

      {stallType === "Food Vendor (£95)" && (
        <>
          <div>
            <label className="block font-bold mb-1">
              Public Liability Insurance (Cloud Storage Link)
            </label>
            <input
              type="url"
              name="public_liability_link"
              placeholder="Paste your file link here"
              required
              className="w-full p-2 rounded border"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">
              Food Hygiene Certificate (Cloud Storage Link)
            </label>
            <input
              type="url"
              name="food_hygiene_link"
              placeholder="Paste your file link here"
              required
              className="w-full p-2 rounded border"
            />
          </div>
        </>
      )}

      {/* Message */}
      <div>
        <label className="block font-bold mb-1">Message / Requirements</label>
        <textarea
          name="message"
          rows={4}
          className="w-full p-2 rounded border"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full bg-yellow-400 text-black py-3 rounded font-bold hover:bg-yellow-300 hover:scale-105 transition-transform cursor-pointer"
      >
        Apply for Burton Pride
      </button>
    </form>
  );
}
