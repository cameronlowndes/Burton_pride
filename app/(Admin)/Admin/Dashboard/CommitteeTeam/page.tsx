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
  isMainAdmin?: boolean;
  member?: Member;
  members?: Member[];
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

function safeNumber(value: unknown, fallback = 50) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function MyCommitteeStoryPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

      const data: ApiResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load committee profile");
      }

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
      setError(err instanceof Error ? err.message : "Failed to load profile");
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

    const data = await res.json();

    if (!res.ok || !data?.ok || !data?.url) {
      throw new Error(data?.error || "Upload failed");
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
      setError(err instanceof Error ? err.message : "Failed to upload image");
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
      setError(err instanceof Error ? err.message : "Failed to upload image");
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

      const data: ApiResponse = await res.json();

      if (!res.ok || !data.ok || !data.member) {
        throw new Error(data.error || "Failed to save profile");
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
      setError(err instanceof Error ? err.message : "Failed to save profile");
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

      const data: ApiResponse = await res.json();

      if (!res.ok || !data.ok || !data.member) {
        throw new Error(data.error || "Failed to create member");
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
      setSuccess("New committee member created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create member");
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
      <div className="min-h-screen bg-gradient-to-r px-6 py-8 text-white">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl">
          Loading committee members...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-4xl font-bold">
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
                onClick={() => setCreateOpen(true)}
                className="rounded-2xl bg-white px-6 py-3 font-bold text-pink-600 transition hover:scale-105 hover:bg-white/90"
              >
                + Create New Member
              </button>
            )}
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-white">
              {error}
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {members.map((item) => {
                  const selectedCard = selectedId === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleMemberClick(item)}
                      className={`overflow-hidden rounded-3xl border p-5 text-left shadow-xl transition ${
                        selectedCard
                          ? "border-white bg-white/20 ring-2 ring-white/70"
                          : "border-white/15 bg-white/10 hover:bg-white/15"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/20 bg-white/10">
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
                          <p className="truncate text-xl font-bold">{item.full_name}</p>
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
            <form onSubmit={saveProfile} className="mt-10 space-y-5">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-lg font-semibold">{member.full_name}</p>
                <p className="text-white/75">{member.role}</p>
                <p className="text-sm text-white/60">{member.email}</p>
                <p className="mt-2 text-xs font-semibold text-white/70">
                  Current display order: {form.display_order}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={form.full_name}
                    onChange={updateField}
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
                    placeholder="Member name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={updateField}
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
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
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
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
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
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
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
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
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
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
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-pink-600"
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

                  <div className="flex flex-col gap-6 lg:flex-row">
                    <div>
                      <div className="relative h-48 w-48 overflow-hidden rounded-2xl border border-white/20 bg-white/10">
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
                          className="w-full"
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
                          className="w-full"
                        />
                      </div>

                      <p className="text-sm text-white/70">
                        Move the sliders until the face sits nicely in the preview circle.
                      </p>

                      <p className="break-all text-xs text-white/60">
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
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
                  placeholder="Why I Joined Burton Pride"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold">Story</label>
                <textarea
                  name="story"
                  rows={16}
                  value={form.story}
                  onChange={updateField}
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
                  placeholder="Write story here..."
                />
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="is_published"
                    checked={form.is_published}
                    onChange={updateField}
                    className="h-5 w-5 rounded"
                  />
                  <span className="text-sm font-semibold">{publishedLabel}</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving || !member || uploadingEditImage}
                  className="rounded-2xl bg-white px-6 py-3 font-bold text-pink-600 transition hover:scale-105 hover:bg-white/90 disabled:opacity-60"
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
                    className="rounded-2xl bg-white/15 px-6 py-3 font-bold text-white transition hover:bg-white/25"
                  >
                    Close Details
                  </button>
                )}
              </div>
            </form>
          )}

          {isMainAdmin && !member && members.length > 0 && (
            <div className="mt-10 rounded-3xl border border-dashed border-white/25 bg-white/5 p-10 text-center">
              <h3 className="text-2xl font-bold">Select a committee member</h3>
              <p className="mt-2 text-white/75">
                Click one of the member cards above to view and edit their details.
              </p>
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-white/20 bg-gradient-to-br from-pink-500/90 via-purple-500/90 to-blue-500/90 p-6 text-white shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold">Create New Committee Member</h2>
                <p className="mt-1 text-white/80">
                  Add a new member, then you can edit them from the list.
                </p>
              </div>

              <button
                type="button"
                onClick={() => !creating && setCreateOpen(false)}
                className="rounded-2xl bg-white/15 px-4 py-2 font-bold text-white transition hover:bg-white/25"
              >
                Close
              </button>
            </div>

            <form onSubmit={createMember} className="mt-6 space-y-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={createForm.full_name}
                    onChange={updateCreateField}
                    required
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
                    placeholder="Member name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={createForm.email}
                    onChange={updateCreateField}
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
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
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
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
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
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
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
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
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
                    min={0}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">Upload Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCreateImageUpload}
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-pink-600"
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
                      <div className="relative h-48 w-48 overflow-hidden rounded-2xl border border-white/20 bg-white/10">
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
                          className="w-full"
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
                          className="w-full"
                        />
                      </div>

                      <p className="text-sm text-white/70">
                        Move the sliders until the face sits nicely in the preview circle.
                      </p>

                      <p className="break-all text-xs text-white/60">
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
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
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
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/50"
                  placeholder="Write story here..."
                />
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="is_published"
                    checked={createForm.is_published}
                    onChange={updateCreateField}
                    className="h-5 w-5 rounded"
                  />
                  <span className="text-sm font-semibold">
                    {createForm.is_published
                      ? "Published on website"
                      : "Hidden from website"}
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => !creating && setCreateOpen(false)}
                  className="rounded-2xl bg-white/15 px-6 py-3 font-bold text-white transition hover:bg-white/25"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating || uploadingCreateImage}
                  className="rounded-2xl bg-white px-6 py-3 font-bold text-pink-600 transition hover:scale-105 hover:bg-white/90 disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}