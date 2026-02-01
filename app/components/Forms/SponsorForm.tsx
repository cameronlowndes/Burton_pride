"use client";

import React, { useState, useEffect } from "react";
import { useForm, ValidationError } from "@formspree/react";

export default function SponsorForm() {
    const [sponsorType, setSponsorType] = useState("");
    const [state, handleSubmit] = useForm("mkozglqn"); // your Formspree ID

    // Redirect to Thank You page on success
    useEffect(() => {
        if (state.succeeded) {
            window.location.href = "/ThankYou";
        }
    }, [state.succeeded]);

    return (
        <form
            onSubmit={(e) => handleSubmit(e)}
            className="max-w-3xl mx-auto p-8 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white rounded-3xl shadow-2xl border-4 border-white/30 flex flex-col gap-6"
        >
            {/* Sponsor Information */}
            <h2 className="text-2xl font-bold mb-4 text-white drop-shadow-md">
                Sponsor Information
            </h2>

            <input
                type="text"
                name="sponsor_name"
                placeholder="Company / Sponsor Name"
                required
                className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"
            />

            <input
                type="text"
                name="contact_name"
                placeholder="Contact Name"
                required
                className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"
            />

            <input
                type="email"
                name="email"
                placeholder="Email Address"
                required
                className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"
            />
            <ValidationError prefix="Email" field="email" errors={state.errors} className="text-yellow-300" />

            <input
                type="tel"
                name="phone"
                placeholder="Phone Number"
                className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"
            />

            <select
                id="sponsorship_type"
                name="sponsorship_type"
                required
                value={sponsorType}
                onChange={(e) => setSponsorType(e.target.value)}
                className="p-3 border border-white/20 rounded-lg bg-white/10 text-black"
            >
                <option value="">Select one</option>
                <option value="Normal Sponsor">Normal Sponsor</option>
                <option value="Sponsorship in Kind">Sponsorship in Kind</option>
            </select>


            {/* Optional Logo Upload */}
            {sponsorType === "Normal Sponsor" && (
                <input
                    type="url"
                    name="logo_link"
                    placeholder="Company Logo (Cloud Storage Link)"
                    className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"
                />
            )}

            {/* Message */}
            <textarea
                name="message"
                placeholder="Message / Requirements"
                rows={4}
                className="p-3 border border-white/20 rounded-lg bg-white/10 placeholder-white/70 text-white"
            />
            <ValidationError prefix="Message" field="message" errors={state.errors} className="text-yellow-300" />

            {/* Submit Button */}
            <button
                type="submit"
                disabled={state.submitting}
                className="bg-white text-pink-600 font-bold py-3 px-6 rounded-lg hover:bg-white/90 transition transform hover:scale-105 shadow-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
                Submit
            </button>
        </form>
    );
}
