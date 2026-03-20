"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type SponsorRow = {
  id: string;
  sponsor_name: string;
  sponsorship_type: string | null;
  logo_link: string | null;
  story: string | null;
  slug: string | null;
  display_order: number | null;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  sponsors?: SponsorRow[];
};

type CreateSponsorForm = {
  sponsor_name: string;
  sponsorship_type: string;
  website: string;
  story: string;
  notes: string;
  slug: string;
};

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

async function parseJsonResponse(res: Response) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    if (text.trim().startsWith("<")) {
      throw new Error(
        "The server returned HTML instead of JSON. This usually means the API route is missing, blocked by middleware, or redirected."
      );
    }

    throw new Error("The server returned invalid JSON.");
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFileExtension(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "png" : "png";
}

export default function AdminSponsorsPage() {
  const supabase = useMemo(() => supabaseBrowser, []);

  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [createForm, setCreateForm] = useState<CreateSponsorForm>({
    sponsor_name: "",
    sponsorship_type: "normal_sponsorship",
    website: "",
    story: "",
    notes: "",
    slug: "",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const isStoryType = createForm.sponsorship_type === "Story";

  useEffect(() => {
    async function loadSponsors() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/sponsors/approved", {
          cache: "no-store",
        });

        const data: ApiResponse = await parseJsonResponse(res);

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load sponsors");
        }

        setSponsors(data.sponsors ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sponsors");
      } finally {
        setLoading(false);
      }
    }

    void loadSponsors();
  }, []);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  function handleMoveUp(index: number) {
    if (index === 0) return;
    setSponsors((current) => moveItem(current, index, index - 1));
    setSuccessMessage(null);
    setError(null);
  }

  function handleMoveDown(index: number) {
    if (index === sponsors.length - 1) return;
    setSponsors((current) => moveItem(current, index, index + 1));
    setSuccessMessage(null);
    setError(null);
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
    setSuccessMessage(null);
    setError(null);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault();

    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(index: number) {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setSponsors((current) => moveItem(current, draggedIndex, index));
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function openCreateModal() {
    setCreateForm({
      sponsor_name: "",
      sponsorship_type: "normal_sponsorship",
      website: "",
      story: "",
      notes: "",
      slug: "",
    });
    setLogoFile(null);
    setLogoPreview(null);
    setError(null);
    setSuccessMessage(null);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (creating) return;
    setShowCreateModal(false);
  }

  function updateCreateForm<K extends keyof CreateSponsorForm>(
    key: K,
    value: CreateSponsorForm[K]
  ) {
    setCreateForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "sponsor_name" && !current.slug.trim()) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  }

  async function uploadLogo(file: File, sponsorName: string) {
    const extension = getFileExtension(file.name);
    const safeName = slugify(sponsorName || "sponsor");
    const filePath = `logos/${safeName}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("sponsor-logos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message || "Failed to upload logo.");
    }

    const { data } = supabase.storage.from("sponsors").getPublicUrl(filePath);

    if (!data?.publicUrl) {
      throw new Error("Logo uploaded but public URL could not be created.");
    }

    return data.publicUrl;
  }

  async function handleCreateSponsor(e: React.FormEvent) {
    e.preventDefault();

    try {
      setCreating(true);
      setError(null);
      setSuccessMessage(null);

      const sponsorName = createForm.sponsor_name.trim();
      const sponsorType = createForm.sponsorship_type.trim();
      const website = createForm.website.trim();
      const story = createForm.story.trim();
      const notes = createForm.notes.trim();
      const slug =
        isStoryType && createForm.slug.trim()
          ? createForm.slug.trim()
          : isStoryType
          ? slugify(sponsorName)
          : null;

      if (!sponsorName) {
        throw new Error("Sponsor name is required.");
      }

      if (isStoryType && !story) {
        throw new Error("Story is required for Story sponsors.");
      }

      let uploadedLogoUrl: string | null = null;

      if (logoFile) {
        uploadedLogoUrl = await uploadLogo(logoFile, sponsorName);
      }

      const res = await fetch("/api/admin/sponsors/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sponsor_name: sponsorName,
          sponsorship_type: sponsorType || "normal_sponsorship",
          logo_link: uploadedLogoUrl,
          website: website || null,
          story: story || null,
          message: notes || null,
          slug,
        }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to create sponsor");
      }

      const createdSponsor: SponsorRow | null = data?.sponsor
        ? {
            id: String(data.sponsor.id),
            sponsor_name: data.sponsor.sponsor_name ?? sponsorName,
            sponsorship_type: data.sponsor.sponsorship_type ?? sponsorType,
            logo_link: data.sponsor.logo_link ?? uploadedLogoUrl ?? null,
            story: data.sponsor.story ?? story ?? null,
            slug: data.sponsor.slug ?? slug ?? null,
            display_order:
              typeof data.sponsor.display_order === "number"
                ? data.sponsor.display_order
                : sponsors.length + 1,
          }
        : null;

      if (createdSponsor) {
        setSponsors((current) => [...current, createdSponsor]);
      }

      setShowCreateModal(false);
      setLogoFile(null);
      setLogoPreview(null);
      setSuccessMessage("Sponsor created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sponsor");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveOrder() {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const payload = sponsors.map((sponsor, index) => ({
        id: sponsor.id,
        display_order: index + 1,
      }));

      const res = await fetch("/api/admin/sponsors/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: payload }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save sponsor order");
      }

      setSponsors((current) =>
        current.map((item, index) => ({
          ...item,
          display_order: index + 1,
        }))
      );

      setSuccessMessage("Sponsor order updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="min-h-screen p-6 text-white md:p-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Manage Sponsor Order</h1>
              <p className="mt-2 text-white/80">
                Drag sponsors into the order you want them to appear on the public
                sponsors page.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <Link
                href="/Admin/Dashboard/Forms/Sponsors"
                className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                Message Version
              </Link>

              <Link
                href="/Admin/Dashboard/Forms/Sponsors/Sponsors-list-version"
                className="inline-flex items-center justify-center rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                List Version
              </Link>

              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                Create Sponsor
              </button>

              <button
                onClick={handleSaveOrder}
                disabled={saving || loading || sponsors.length === 0}
                className="rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Order"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 rounded-2xl border border-green-400/30 bg-green-500/10 px-4 py-3 text-green-100">
              {successMessage}
            </div>
          )}

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center text-white/80 backdrop-blur-md">
              Loading sponsors...
            </div>
          ) : sponsors.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center text-white/80 backdrop-blur-md">
              No approved sponsors found.
            </div>
          ) : (
            <div className="space-y-4">
              {sponsors.map((sponsor, index) => {
                const isDragging = draggedIndex === index;
                const isDragOver =
                  dragOverIndex === index && draggedIndex !== index;

                return (
                  <div
                    key={sponsor.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={`flex cursor-grab flex-col gap-4 rounded-3xl border bg-white/10 p-4 shadow-lg backdrop-blur-md transition md:flex-row md:items-center md:justify-between ${
                      isDragging
                        ? "scale-[0.99] border-pink-300/40 opacity-60"
                        : isDragOver
                        ? "border-yellow-300/50 bg-white/15"
                        : "border-white/10"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold text-white/80">
                        {index + 1}
                      </div>

                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg text-white/70">
                        ⋮⋮
                      </div>

                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white">
                        {sponsor.logo_link ? (
                          <Image
                            src={sponsor.logo_link}
                            alt={sponsor.sponsor_name}
                            fill
                            className="object-contain p-2"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-gray-500">
                            No logo
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-white">
                          {sponsor.sponsor_name}
                        </h2>
                        <p className="truncate text-sm text-white/70">
                          {sponsor.sponsorship_type || "Sponsor"}
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          Drag to reorder
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Move Up
                      </button>

                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === sponsors.length - 1}
                        className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Move Down
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#140727] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Create Sponsor</h2>
                <p className="mt-1 text-sm text-white/70">
                  Add a sponsor directly from the admin portal.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateSponsor} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Sponsor Name
                </label>
                <input
                  type="text"
                  value={createForm.sponsor_name}
                  onChange={(e) =>
                    updateCreateForm("sponsor_name", e.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                  placeholder="Burton Pride Sponsor"
                  required
                />
              </div>

              <div
                className={`grid gap-4 ${
                  isStoryType ? "sm:grid-cols-2" : "sm:grid-cols-1"
                }`}
              >
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Sponsor Type
                  </label>
                  <select
                    value={createForm.sponsorship_type}
                    onChange={(e) =>
                      updateCreateForm("sponsorship_type", e.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
                  >
                    <option value="normal_sponsorship" className="text-black">
                      Normal Sponsorship
                    </option>
                    <option value="sponsorship_in_kind" className="text-black">
                      Sponsorship in Kind
                    </option>
                    <option value="Story" className="text-black">
                      Story
                    </option>
                  </select>
                </div>

                {isStoryType && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Slug
                    </label>
                    <input
                      type="text"
                      value={createForm.slug}
                      onChange={(e) => updateCreateForm("slug", e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="burton-pride-sponsor"
                      required={isStoryType}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-white/80">
                  Logo Upload
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setLogoFile(file);
                  }}
                  className="block w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white/20 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-white/30"
                />

                {logoPreview ? (
                  <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-white">
                    <Image
                      src={logoPreview}
                      alt="Logo preview"
                      fill
                      className="object-contain p-4"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/60">
                    No logo selected
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Website
                </label>
                <input
                  type="url"
                  value={createForm.website}
                  onChange={(e) =>
                    updateCreateForm("website", e.target.value)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                  placeholder="https://..."
                />
              </div>

              {isStoryType && (
                <div className="rounded-2xl border border-pink-300/30 bg-pink-500/10 p-4">
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Sponsor Story
                  </label>

                  <textarea
                    value={createForm.story}
                    onChange={(e) => updateCreateForm("story", e.target.value)}
                    rows={6}
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="Write the sponsor story here..."
                    required={isStoryType}
                  />

                  <p className="mt-2 text-xs text-pink-100/80">
                    This story will be used for the sponsor story page and public
                    display.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <label className="mb-2 block text-sm font-semibold text-white/80">
                  Description / Notes
                </label>

                <textarea
                  value={createForm.notes}
                  onChange={(e) => updateCreateForm("notes", e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                  placeholder="Add sponsor details, notes, or short description..."
                />
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creating}
                  className="rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/20 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create Sponsor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}