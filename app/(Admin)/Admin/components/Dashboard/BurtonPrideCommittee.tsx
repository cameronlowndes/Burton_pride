"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Member = {
  id: string;
  full_name: string;
  email: string | null;
  image_url: string | null;
  role: string;
  pronouns: string | null;
  section_title: string;
  story_title: string | null;
  story: string | null;
  display_order: number;
  is_published: boolean;
  image_position_x: number | null;
  image_position_y: number | null;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  details?: unknown;
  technicalDetails?: unknown;
  hint?: string;
  code?: string;
  isMainAdmin?: boolean;
  member?: Member;
  members?: Member[];
  url?: string;
};

const emptyForm = {
  full_name: "",
  role: "",
  pronouns: "",
  section_title: "Committed Board",
  story_title: "Why I Joined Burton Pride",
  story: "",
  image_url: "",
  email: "",
  is_published: true,
  display_order: 999,
  image_position_x: 50,
  image_position_y: 50,
};

const emptyCreateForm = {
  full_name: "",
  role: "",
  pronouns: "",
  section_title: "Committed Board",
  story_title: "Why I Joined Burton Pride",
  story: "",
  image_url: "",
  email: "",
  is_published: true,
  display_order: 999,
  image_position_x: 50,
  image_position_y: 50,
};

const inputClass =
  "min-h-12 w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-purple-300/40 focus:bg-black/30 focus:ring-2 focus:ring-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

const textareaClass =
  "w-full resize-y rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-base font-semibold leading-6 text-white outline-none transition placeholder:text-white/35 focus:border-purple-300/40 focus:bg-black/30 focus:ring-2 focus:ring-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

const fileInputClass =
  "min-h-12 w-full rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-base text-white file:mr-3 file:min-h-10 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-black file:text-pink-600 hover:file:bg-white/90 focus:outline-none focus:ring-2 focus:ring-purple-500/20 sm:text-sm";

function safeNumber(value: unknown, fallback = 50) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stringifyDetails(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildDetailedErrorMessage({
  fallback,
  response,
  payload,
}: {
  fallback: string;
  response?: Response;
  payload?: ApiResponse | null;
  rawText?: string;
}) {
  const requestId =
    typeof payload?.code === "string" && payload.code.trim()
      ? payload.code.trim()
      : "";

  let message =
    payload?.message ||
    payload?.error ||
    fallback;

  if (response?.status === 401) {
    message = "Your admin session has expired. Please sign in again.";
  } else if (response?.status === 403) {
    message = "Your account does not have permission to manage committee profiles.";
  } else if (response?.status === 413) {
    message = "The selected image is too large. Please choose a smaller image.";
  } else if (response?.status === 429) {
    message = "Too many requests were made. Please wait a moment and try again.";
  } else if (response && response.status >= 500) {
    message = "The committee profile service is temporarily unavailable.";
  }

  return requestId ? `${message} Reference: ${requestId}` : message;
}

async function readJsonResponse(response: Response, fallback: string) {
  const rawText = await response.text();
  let payload: ApiResponse | null = null;

  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(
      buildDetailedErrorMessage({
        fallback,
        response,
        payload,
        rawText,
      })
    );
  }

  return payload;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export default function CommitteeStoryClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createErrorPopup, setCreateErrorPopup] =
    useState<string | null>(null);

  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  const [uploadingCreateImage, setUploadingCreateImage] = useState(false);

  function fillFormFromMember(target: Member) {
    setMember(target);
    setSelectedId(target.id);
    setForm({
      full_name: target.full_name || "",
      role: target.role || "",
      pronouns: target.pronouns || "",
      section_title: target.section_title || "Committed Board",
      story_title: target.story_title || "Why I Joined Burton Pride",
      story: target.story || "",
      image_url: target.image_url || "",
      email: target.email || "",
      is_published: !!target.is_published,
      display_order: Number.isFinite(target.display_order)
        ? target.display_order
        : 999,
      image_position_x: safeNumber(target.image_position_x, 50),
      image_position_y: safeNumber(target.image_position_y, 50),
    });
  }

  function clearSelectedMember() {
    setMember(null);
    setSelectedId("");
    setForm(emptyForm);
  }

  async function loadProfile(memberId?: string) {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const query = memberId ? `?id=${encodeURIComponent(memberId)}` : "";
      const res = await fetch(`/api/admin/committee/me${query}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await readJsonResponse(
        res,
        "Failed to load committee profile"
      );

      setIsMainAdmin(!!data.isMainAdmin);

      if (data.isMainAdmin) {
        const list = data.members || (data.member ? [data.member] : []);
        const sorted = [...list].sort(
          (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
        );

        setMembers(sorted);

        if (memberId) {
          const found = sorted.find((m) => m.id === memberId);
          if (found) {
            fillFormFromMember(found);
          } else {
            clearSelectedMember();
          }
        } else {
          clearSelectedMember();
        }
      } else if (data.member) {
        setMembers([data.member]);
        fillFormFromMember(data.member);
      } else {
        throw new Error("Profile not found");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load profile"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  function updateField(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;

    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? target.checked
          : name === "display_order" ||
            name === "image_position_x" ||
            name === "image_position_y"
          ? Number(value)
          : value,
    }));
  }

  function updateCreateField(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;

    setCreateForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? target.checked
          : name === "display_order" ||
            name === "image_position_x" ||
            name === "image_position_y"
          ? Number(value)
          : value,
    }));
  }

  async function uploadImage(file: File): Promise<string> {
    const safeFileName = file.name.replace(/\s+/g, "-").toLowerCase();
    const uniqueFileName = `committee/${Date.now()}-${safeFileName}`;

    const res = await fetch("/api/admin/committee/upload", {
      method: "POST",
      headers: {
        "x-file-name": uniqueFileName,
        "x-file-type": file.type,
      },
      body: file,
    });

    const data = await readJsonResponse(res, "Upload failed");

    if (!data.url) {
      throw new Error("Upload finished, but the API did not return an image URL.");
    }

    return data.url;
  }

  async function handleEditImageUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingEditImage(true);
      setError(null);
      setSuccess(null);

      const url = await uploadImage(file);

      setForm((prev) => ({
        ...prev,
        image_url: url,
        image_position_x: 50,
        image_position_y: 50,
      }));

      setSuccess("Image uploaded successfully. You can now move the crop to center the face.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to upload image"));
    } finally {
      setUploadingEditImage(false);
      e.target.value = "";
    }
  }

  async function handleCreateImageUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingCreateImage(true);
      setError(null);
      setSuccess(null);

      const url = await uploadImage(file);

      setCreateForm((prev) => ({
        ...prev,
        image_url: url,
        image_position_x: 50,
        image_position_y: 50,
      }));

      setSuccess("Image uploaded successfully. You can now move the crop to center the face.");
    } catch (err) {
      const message = getErrorMessage(
        err,
        "The image could not be uploaded.",
      );

      setCreateErrorPopup(message);
    } finally {
      setUploadingCreateImage(false);
      e.target.value = "";
    }
  }

  async function handleMemberClick(target: Member) {
    fillFormFromMember(target);
    await loadProfile(target.id);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = {
        id: isMainAdmin ? selectedId : member?.id,
        full_name: form.full_name,
        role: form.role,
        pronouns: form.pronouns,
        section_title: form.section_title,
        story_title: form.story_title,
        story: form.story,
        image_url: form.image_url,
        email: form.email,
        is_published: form.is_published,
        display_order: Number(form.display_order) || 999,
        image_position_x: Number(form.image_position_x) || 50,
        image_position_y: Number(form.image_position_y) || 50,
      };

      const res = await fetch("/api/admin/committee/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonResponse(res, "Failed to save profile");

      if (!data.member) {
        throw new Error("Save finished, but the API did not return the updated member.");
      }

      setMember(data.member);
      fillFormFromMember(data.member);
      setSuccess("Committee member details updated successfully.");

      if (isMainAdmin) {
        setMembers((prev) =>
          prev
            .map((item) => (item.id === data.member!.id ? data.member! : item))
            .sort(
              (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
            )
        );
      } else {
        setMembers([data.member]);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save profile"));
    } finally {
      setSaving(false);
    }
  }

  async function createMember(e: React.FormEvent) {
    e.preventDefault();

    try {
      setCreating(true);
      setError(null);
      setSuccess(null);
      setCreateErrorPopup(null);

      const res = await fetch("/api/admin/committee", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...createForm,
          display_order: Number(createForm.display_order) || 999,
          image_position_x: Number(createForm.image_position_x) || 50,
          image_position_y: Number(createForm.image_position_y) || 50,
        }),
      });

      const data = await readJsonResponse(res, "Failed to create member");

      if (!data.member) {
        throw new Error("Create finished, but the API did not return the new member.");
      }

      const created = data.member;

      setMembers((prev) =>
        [...prev, created].sort(
          (a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)
        )
      );

      fillFormFromMember(created);
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      setCreateErrorPopup(null);
      setSuccess("New committee member created successfully.");
    } catch (err) {
      const message = getErrorMessage(
        err,
        "The new committee member could not be created.",
      );

      setCreateErrorPopup(message);
    } finally {
      setCreating(false);
    }
  }

  const publishedLabel = useMemo(
    () => (form.is_published ? "Published on website" : "Hidden from website"),
    [form.is_published]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent px-3 py-4 text-white sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-none rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl sm:rounded-3xl sm:p-6">
          Loading committee members...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-3 py-4 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-none">
        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                {isMainAdmin ? "Committee Member Manager" : "My Committee Story"}
              </h1>

              <p className="mt-2 text-white/80">
                {isMainAdmin
                  ? "Click any committee member below to edit their details, role, story, image, visibility, screen order, and image crop position."
                  : "Update your own committee profile and story for the website."}
              </p>
            </div>

            {isMainAdmin && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setCreateErrorPopup(null);
                  setCreateOpen(true);
                }}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-pink-600 transition hover:bg-white/90 active:scale-[0.99] sm:w-auto"
              >
                + Create New Member
              </button>
            )}
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-white">
              <p className="mb-2 font-black">Something went wrong</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/90">
                {error}
              </p>
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-2xl border border-green-300/30 bg-green-500/20 px-4 py-3 text-white">
              {success}
            </div>
          )}

          {members.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 text-2xl font-bold">
                {isMainAdmin ? "Committee Members" : "Your Profile"}
              </h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {members.map((item) => {
                  const selectedCard = selectedId === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleMemberClick(item)}
                      className={`min-w-0 overflow-hidden rounded-2xl border p-4 text-left shadow-xl transition sm:rounded-3xl sm:p-5 ${
                        selectedCard
                          ? "border-white bg-white/20 ring-2 ring-white/70"
                          : "border-white/15 bg-white/10 hover:bg-white/15"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10 sm:h-20 sm:w-20">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.full_name}
                              fill
                              className="object-cover"
                              style={{
                                objectPosition: `${safeNumber(item.image_position_x, 50)}% ${safeNumber(item.image_position_y, 50)}%`,
                              }}
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-white/70">
                              {item.full_name.charAt(0)}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="break-words text-lg font-black sm:text-xl">{item.full_name}</p>
                          <p className="mt-1 text-sm text-white/80">{item.role}</p>
                          <p className="mt-1 text-xs text-white/60">
                            {item.email || "No email linked"}
                          </p>

                          <div className="mt-2 text-xs font-semibold text-white/75">
                            Order: {item.display_order ?? 999}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                item.is_published
                                  ? "bg-emerald-500/80 text-white"
                                  : "bg-slate-500/70 text-white"
                              }`}
                            >
                              {item.is_published ? "Live" : "Hidden"}
                            </span>

                            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                              {item.section_title}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {member && (
            <form onSubmit={saveProfile} className="mt-8 space-y-5 sm:mt-10">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-lg font-semibold">{member.full_name}</p>
                <p className="text-white/75">{member.role}</p>
                <p className="text-sm text-white/60">{member.email}</p>
                <p className="mt-2 text-xs font-semibold text-white/70">
                  Current display order: {form.display_order}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    autoComplete="name"
                    value={form.full_name}
                    onChange={updateField}
                    className={inputClass}
                    placeholder="Member name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Email</label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={updateField}
                    className={inputClass}
                    placeholder="member@email.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Role</label>
                  <input
                    type="text"
                    name="role"
                    value={form.role}
                    onChange={updateField}
                    className={inputClass}
                    placeholder="Board Member | He/Him"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Pronouns</label>
                  <input
                    type="text"
                    name="pronouns"
                    value={form.pronouns}
                    onChange={updateField}
                    className={inputClass}
                    placeholder="He/Him, She/Her, They/Them"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Section Title</label>
                  <input
                    type="text"
                    name="section_title"
                    value={form.section_title}
                    onChange={updateField}
                    className={inputClass}
                    placeholder="Committed Board"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Display Order</label>
                  <input
                    type="number"
                    name="display_order"
                    value={form.display_order}
                    onChange={updateField}
                    className={inputClass}
                    placeholder="1"
                    min={0}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">Upload Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageUpload}
                    className={fileInputClass}
                  />
                  {uploadingEditImage && (
                    <p className="mt-2 text-sm text-white/70">Uploading image...</p>
                  )}
                </div>
              </div>

              {form.image_url && (
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="mb-3 text-sm font-semibold text-white/80">
                    Image Preview
                  </p>

                  <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
                    <div>
                      <div className="relative aspect-square w-full max-w-64 overflow-hidden rounded-2xl border border-white/20 bg-white/10 sm:w-48">
                        <Image
                          src={form.image_url}
                          alt={form.full_name || "Committee member image"}
                          fill
                          className="object-cover"
                          style={{
                            objectPosition: `${form.image_position_x}% ${form.image_position_y}%`,
                          }}
                          unoptimized
                        />
                      </div>
                    </div>

                    <div className="flex-1 space-y-5">
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Move image left / right: {form.image_position_x}%
                        </label>
                        <input
                          type="range"
                          name="image_position_x"
                          min={0}
                          max={100}
                          value={form.image_position_x}
                          onChange={updateField}
                          className="h-8 w-full cursor-pointer accent-pink-400"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Move image up / down: {form.image_position_y}%
                        </label>
                        <input
                          type="range"
                          name="image_position_y"
                          min={0}
                          max={100}
                          value={form.image_position_y}
                          onChange={updateField}
                          className="h-8 w-full cursor-pointer accent-pink-400"
                        />
                      </div>

                      <p className="text-sm text-white/70">
                        Move the sliders until the face sits nicely in the preview circle.
                      </p>

                      <p className="break-words text-xs leading-5 text-white/60">
                        {form.image_url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold">Story Title</label>
                <input
                  type="text"
                  name="story_title"
                  value={form.story_title}
                  onChange={updateField}
                  className={inputClass}
                  placeholder="Why I Joined Burton Pride"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Story</label>
                <textarea
                  name="story"
                  rows={10}
                  value={form.story}
                  onChange={updateField}
                  className={textareaClass}
                  placeholder="Write story here..."
                />
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <label className="flex min-h-12 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="is_published"
                    checked={form.is_published}
                    onChange={updateField}
                    className="h-6 w-6 shrink-0 rounded accent-pink-500"
                  />
                  <span className="text-sm font-semibold">{publishedLabel}</span>
                </label>
              </div>

              <div className="grid gap-3 sm:flex sm:flex-wrap">
                <button
                  type="submit"
                  disabled={saving || !member || uploadingEditImage}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-pink-600 transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {saving
                    ? "Saving..."
                    : isMainAdmin
                    ? "Save Member Details"
                    : "Save My Story"}
                </button>

                {isMainAdmin && (
                  <button
                    type="button"
                    onClick={clearSelectedMember}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white/15 px-5 py-3 text-sm font-black text-white transition hover:bg-white/25 sm:w-auto"
                  >
                    Close Details
                  </button>
                )}
              </div>
            </form>
          )}

          {isMainAdmin && !member && members.length > 0 && (
            <div className="mt-8 rounded-2xl border border-dashed border-white/25 bg-white/5 p-5 text-center sm:mt-10 sm:rounded-3xl sm:p-10">
              <h3 className="text-2xl font-bold">Select a committee member</h3>
              <p className="mt-2 text-white/75">
                Click one of the member cards above to view and edit their details.
              </p>
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[2rem] border border-white/15 bg-gradient-to-br from-pink-500/95 via-purple-500/95 to-blue-500/95 text-white shadow-2xl backdrop-blur-xl sm:max-h-[90dvh] sm:rounded-3xl">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-black leading-tight sm:text-3xl">Create New Committee Member</h2>
                <p className="mt-1 text-white/80">
                  Add a new member, then you can edit them from the list.
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    setCreateErrorPopup(
                      "Test error: this is how a Create New Member error will appear. No member has been created and no data has been changed.",
                    )
                  }
                  disabled={creating}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-500/15 px-3 py-2 text-xs font-black text-amber-50 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                >
                  Test error popup
                </button>

                <button
                  type="button"
                  onClick={() => !creating && setCreateOpen(false)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white/15 px-3 py-2 text-sm font-black text-white transition hover:bg-white/25"
                >
                  Close
                </button>
              </div>
            </div>

            <form onSubmit={createMember} className="mt-6 space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    autoComplete="name"
                    value={createForm.full_name}
                    onChange={updateCreateField}
                    required
                    className={inputClass}
                    placeholder="Member name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Email</label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={createForm.email}
                    onChange={updateCreateField}
                    className={inputClass}
                    placeholder="member@email.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Role</label>
                  <input
                    type="text"
                    name="role"
                    value={createForm.role}
                    onChange={updateCreateField}
                    required
                    className={inputClass}
                    placeholder="Board Member | He/Him"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Pronouns</label>
                  <input
                    type="text"
                    name="pronouns"
                    value={createForm.pronouns}
                    onChange={updateCreateField}
                    className={inputClass}
                    placeholder="He/Him, She/Her, They/Them"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Section Title</label>
                  <input
                    type="text"
                    name="section_title"
                    value={createForm.section_title}
                    onChange={updateCreateField}
                    className={inputClass}
                    placeholder="Committed Board"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Display Order</label>
                  <input
                    type="number"
                    name="display_order"
                    value={createForm.display_order}
                    onChange={updateCreateField}
                    className={inputClass}
                    min={0}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">Upload Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCreateImageUpload}
                    className={fileInputClass}
                  />
                  {uploadingCreateImage && (
                    <p className="mt-2 text-sm text-white/70">Uploading image...</p>
                  )}
                </div>
              </div>

              {createForm.image_url && (
                <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                  <p className="mb-3 text-sm font-semibold text-white/80">
                    Image Preview
                  </p>

                  <div className="flex flex-col gap-6 lg:flex-row">
                    <div>
                      <div className="relative aspect-square w-full max-w-64 overflow-hidden rounded-2xl border border-white/20 bg-white/10 sm:w-48">
                        <Image
                          src={createForm.image_url}
                          alt={createForm.full_name || "New committee member image"}
                          fill
                          className="object-cover"
                          style={{
                            objectPosition: `${createForm.image_position_x}% ${createForm.image_position_y}%`,
                          }}
                          unoptimized
                        />
                      </div>
                    </div>

                    <div className="flex-1 space-y-5">
                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Move image left / right: {createForm.image_position_x}%
                        </label>
                        <input
                          type="range"
                          name="image_position_x"
                          min={0}
                          max={100}
                          value={createForm.image_position_x}
                          onChange={updateCreateField}
                          className="h-8 w-full cursor-pointer accent-pink-400"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Move image up / down: {createForm.image_position_y}%
                        </label>
                        <input
                          type="range"
                          name="image_position_y"
                          min={0}
                          max={100}
                          value={createForm.image_position_y}
                          onChange={updateCreateField}
                          className="h-8 w-full cursor-pointer accent-pink-400"
                        />
                      </div>

                      <p className="text-sm text-white/70">
                        Move the sliders until the face sits nicely in the preview circle.
                      </p>

                      <p className="break-words text-xs leading-5 text-white/60">
                        {createForm.image_url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold">Story Title</label>
                <input
                  type="text"
                  name="story_title"
                  value={createForm.story_title}
                  onChange={updateCreateField}
                  className={inputClass}
                  placeholder="Why I Joined Burton Pride"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Story</label>
                <textarea
                  name="story"
                  rows={10}
                  value={createForm.story}
                  onChange={updateCreateField}
                  className={textareaClass}
                  placeholder="Write story here..."
                />
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <label className="flex min-h-12 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name="is_published"
                    checked={createForm.is_published}
                    onChange={updateCreateField}
                    className="h-6 w-6 shrink-0 rounded accent-pink-500"
                  />
                  <span className="text-sm font-semibold">
                    {createForm.is_published
                      ? "Published on website"
                      : "Hidden from website"}
                  </span>
                </label>
              </div>

              <div className="grid gap-3 sm:flex sm:justify-end">
                <button
                  type="button"
                  onClick={() => !creating && setCreateOpen(false)}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white/15 px-5 py-3 text-sm font-black text-white transition hover:bg-white/25 sm:w-auto"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating || uploadingCreateImage}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-pink-600 transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {creating ? "Creating..." : "Create Member"}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {createErrorPopup && (
        <div
          className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-member-error-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCreateErrorPopup(null);
            }
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-t-[2rem] border border-red-300/20 bg-[#11111f] text-white shadow-2xl sm:rounded-[2rem]">
            <div className="h-1 bg-gradient-to-r from-red-500 via-pink-500 to-purple-500" />

            <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-300/20 bg-red-500/15 text-xl font-black text-red-100">
                  !
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-red-200/65">
                    Create member problem
                  </p>

                  <h2
                    id="create-member-error-title"
                    className="mt-1 text-xl font-black sm:text-2xl"
                  >
                    Something needs fixing
                  </h2>

                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/75">
                    {createErrorPopup}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-white/55">
                Check the form details and try again. If the message includes a
                reference code, give that code to a Main Admin when reporting the
                problem.
              </div>

              <div className="mt-6 grid gap-3 sm:flex sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCreateErrorPopup(null);
                  }}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700 transition hover:bg-white/90 active:scale-[0.99] sm:w-auto"
                >
                  Back to form
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}