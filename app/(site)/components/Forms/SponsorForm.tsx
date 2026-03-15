"use client";

import React, { useState } from "react";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type SubmitState = "idle" | "submitting" | "success" | "error";

type ApiResponse = {
  ok: boolean;
  error?: string;
};

const emptyForm = {
  sponsor_name: "",
  contact_name: "",
  email: "",
  phone: "",
  sponsorship_type: "",
  address_line1: "",
  address_line2: "",
  city: "",
  county: "",
  postcode: "",
  country: "United Kingdom",
  logo_link: "",
  message: "",
};

export default function SponsorForm() {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const [form, setForm] = useState(emptyForm);

  function updateField(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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

  async function uploadLogo(file: File) {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/svg+xml",
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error("Please upload a PNG, JPG, JPEG, WEBP or SVG logo.");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Logo must be 5MB or smaller.");
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const baseName = file.name
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const path = `logos/${Date.now()}-${baseName || "sponsor-logo"}.${ext}`;

    setUploadingLogo(true);

    try {
      const { error: uploadError } = await supabaseBrowser.storage
        .from("sponsor-logos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message || "Failed to upload logo");
      }

      const { data } = supabaseBrowser.storage
        .from("sponsor_applications")
        .getPublicUrl(path);

      if (!data?.publicUrl) {
        throw new Error("Could not get public logo URL");
      }

      return data.publicUrl;
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const publicUrl = await uploadLogo(file);

      setForm((prev) => ({
        ...prev,
        logo_link: publicUrl,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload logo");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitState("submitting");
    setError(null);

    try {
      const res = await fetch("/api/sponsors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sponsor_name: form.sponsor_name.trim(),
          contact_name: form.contact_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          sponsorship_type: form.sponsorship_type.trim(),
          address_line1: form.address_line1.trim(),
          address_line2: form.address_line2.trim(),
          city: form.city.trim(),
          county: form.county.trim(),
          postcode: form.postcode.trim(),
          country: form.country.trim(),
          logo_link: form.logo_link.trim(),
          message: form.message.trim(),
        }),
      });

      const text = await res.text();

      let data: ApiResponse = { ok: false, error: "Unknown error" };

      try {
        data = text ? JSON.parse(text) : { ok: false, error: "Empty response" };
      } catch {
        throw new Error("Server returned invalid JSON");
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to submit sponsor form");
      }

      setSubmitState("success");
      setShowSuccessToast(true);
      resetForm();

      setTimeout(() => {
        setShowSuccessToast(false);
        setSubmitState("idle");
      }, 4500);
    } catch (err) {
      setSubmitState("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <>
      {showSuccessToast && (
        <div className="pointer-events-none fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-6 sm:justify-end sm:items-start sm:pr-6">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-green-300/30 bg-green-600/95 p-4 text-white shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold">
                ✓
              </div>

              <div className="flex-1">
                <h4 className="text-base font-bold">Sponsor form sent successfully</h4>
                <p className="mt-1 text-sm text-white/90">
                  Thank you for your interest in supporting Burton Pride. We have
                  received your sponsorship enquiry.
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
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="mx-auto flex max-w-3xl flex-col gap-6 rounded-3xl border-4 border-white/30 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 p-8 text-white shadow-2xl"
      >
        <h2 className="mb-2 text-2xl font-bold text-white drop-shadow-md">
          Sponsor Information
        </h2>

        <input
          type="text"
          name="sponsor_name"
          placeholder="Company / Sponsor Name"
          required
          value={form.sponsor_name}
          onChange={updateField}
          className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50"
        />

        <input
          type="text"
          name="contact_name"
          placeholder="Contact Name"
          required
          value={form.contact_name}
          onChange={updateField}
          className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50"
        />

        <input
          type="email"
          name="email"
          placeholder="Email Address"
          required
          value={form.email}
          onChange={updateField}
          className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50"
        />

        <input
          type="tel"
          name="phone"
          placeholder="Phone Number"
          value={form.phone}
          onChange={updateField}
          className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50"
        />

        <select
          name="sponsorship_type"
          required
          value={form.sponsorship_type}
          onChange={updateField}
          className="rounded-lg border border-white/20 bg-white/10 p-3 text-white outline-none focus:border-white/50"
        >
          <option value="" className="text-black">
            Select one
          </option>
          <option value="Normal Sponsor" className="text-black">
            Normal Sponsor
          </option>
          <option value="Sponsorship in Kind" className="text-black">
            Sponsorship in Kind
          </option>
        </select>

        <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
          <h3 className="mb-4 text-lg font-semibold">Business Address</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              type="text"
              name="address_line1"
              placeholder="Address line 1"
              value={form.address_line1}
              onChange={updateField}
              className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50 sm:col-span-2"
            />

            <input
              type="text"
              name="address_line2"
              placeholder="Address line 2"
              value={form.address_line2}
              onChange={updateField}
              className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50 sm:col-span-2"
            />

            <input
              type="text"
              name="city"
              placeholder="Town / City"
              value={form.city}
              onChange={updateField}
              className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50"
            />

            <input
              type="text"
              name="county"
              placeholder="County"
              value={form.county}
              onChange={updateField}
              className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50"
            />

            <input
              type="text"
              name="postcode"
              placeholder="Postcode"
              value={form.postcode}
              onChange={updateField}
              className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50"
            />

            <input
              type="text"
              name="country"
              placeholder="Country"
              value={form.country}
              onChange={updateField}
              className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
          <h3 className="mb-3 text-lg font-semibold">Company Logo</h3>

          <input
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleLogoChange}
            className="block w-full rounded-lg border border-white/20 bg-white/10 p-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-pink-600"
          />

          {uploadingLogo && (
            <p className="mt-3 text-sm text-white/80">Uploading logo...</p>
          )}

          {form.logo_link && (
            <div className="mt-4 rounded-2xl border border-green-300/30 bg-green-500/20 p-4">
              <p className="text-sm font-semibold text-white">
                Logo uploaded successfully
              </p>

              <div className="mt-3 overflow-hidden rounded-xl bg-white p-3">
                <div className="relative h-24 w-40">
                  <Image
                    src={form.logo_link}
                    alt="Uploaded sponsor logo preview"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <textarea
          name="message"
          placeholder="Message / Requirements"
          rows={4}
          value={form.message}
          onChange={updateField}
          className="rounded-lg border border-white/20 bg-white/10 p-3 text-white placeholder-white/70 outline-none focus:border-white/50"
        />

        {error && (
          <div className="rounded-xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-sm text-white">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitState === "submitting" || uploadingLogo}
          className="cursor-pointer rounded-lg bg-white px-6 py-3 font-bold text-pink-600 shadow-lg transition hover:scale-105 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitState === "submitting"
            ? "Submitting..."
            : uploadingLogo
            ? "Uploading Logo..."
            : "Submit"}
        </button>
      </form>
    </>
  );
}