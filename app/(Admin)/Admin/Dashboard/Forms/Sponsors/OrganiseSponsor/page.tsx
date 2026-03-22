"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import * as XLSX from "xlsx-js-style";

type SponsorRow = {
  id: string;
  sponsor_name: string;
  sponsorship_type: string | null;
  logo_link: string | null;
  story: string | null;
  slug: string | null;
  display_order: number | null;
};

type SponsorForm = {
  sponsor_name: string;
  contact_name: string;
  email: string;
  phone: string;
  sponsorship_type: string;
  website: string;
  story: string;
  notes: string;
  slug: string;
  address_line1: string;
  address_line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
};

type SponsorPayload = {
  id: string | number;
  sponsor_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  sponsorship_type?: string | null;
  website?: string | null;
  logo_link?: string | null;
  story?: string | null;
  notes?: string | null;
  slug?: string | null;
  display_order?: number | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  country?: string | null;
  created_at?: string | null;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  sponsors?: SponsorRow[];
  sponsor?: SponsorPayload;
};

const SPONSOR_TYPE_NORMAL = "normal_sponsorship";
const SPONSOR_TYPE_KIND = "sponsorship_in_kind";
const SPONSOR_TYPE_STORY = "Story";

function normalizeSponsorType(value?: string | null) {
  const raw = String(value ?? "").trim().toLowerCase();

  if (
    raw === "story" ||
    raw === "sponsor_story" ||
    raw === "sponsor-story"
  ) {
    return SPONSOR_TYPE_STORY;
  }

  if (
    raw === "sponsorship_in_kind" ||
    raw === "sponsorship in kind" ||
    raw === "in_kind" ||
    raw === "inkind"
  ) {
    return SPONSOR_TYPE_KIND;
  }

  return SPONSOR_TYPE_NORMAL;
}

function isStorySponsorType(value?: string | null) {
  return normalizeSponsorType(value) === SPONSOR_TYPE_STORY;
}

function getEmptySponsorForm(): SponsorForm {
  return {
    sponsor_name: "",
    contact_name: "",
    email: "",
    phone: "",
    sponsorship_type: SPONSOR_TYPE_NORMAL,
    website: "",
    story: "",
    notes: "",
    slug: "",
    address_line1: "",
    address_line2: "",
    city: "",
    county: "",
    postcode: "",
    country: "United Kingdom",
  };
}

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

function sponsorPayloadToForm(sponsor?: SponsorPayload | null): SponsorForm {
  const normalizedType = normalizeSponsorType(sponsor?.sponsorship_type);

  return {
    sponsor_name: sponsor?.sponsor_name ?? "",
    contact_name: sponsor?.contact_name ?? "",
    email: sponsor?.email ?? "",
    phone: sponsor?.phone ?? "",
    sponsorship_type: normalizedType,
    website: sponsor?.website ?? "",
    story: sponsor?.story ?? "",
    notes: sponsor?.notes ?? "",
    slug:
      sponsor?.slug?.trim() ||
      (normalizedType === SPONSOR_TYPE_STORY
        ? slugify(sponsor?.sponsor_name ?? "")
        : ""),
    address_line1: sponsor?.address_line1 ?? "",
    address_line2: sponsor?.address_line2 ?? "",
    city: sponsor?.city ?? "",
    county: sponsor?.county ?? "",
    postcode: sponsor?.postcode ?? "",
    country: sponsor?.country ?? "United Kingdom",
  };
}

function formatSubmittedAt(value?: string | null) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSponsorTypeLabel(value?: string | null) {
  const normalizedType = normalizeSponsorType(value);

  if (normalizedType === SPONSOR_TYPE_NORMAL) return "Normal Sponsorship";
  if (normalizedType === SPONSOR_TYPE_KIND) return "Sponsorship in Kind";
  if (normalizedType === SPONSOR_TYPE_STORY) return "Story";
  return value ?? "";
}

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<SponsorForm>(getEmptySponsorForm());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SponsorForm>(getEmptySponsorForm());
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SponsorRow | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const isStoryType = isStorySponsorType(createForm.sponsorship_type);
  const isEditStoryType = isStorySponsorType(editForm.sponsorship_type);

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

        setSponsors(
          (data.sponsors ?? []).map((sponsor) => ({
            ...sponsor,
            sponsorship_type: normalizeSponsorType(sponsor.sponsorship_type),
          }))
        );
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

  useEffect(() => {
    if (!editLogoFile) return;

    const objectUrl = URL.createObjectURL(editLogoFile);
    setEditLogoPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [editLogoFile]);

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
    if (dragOverIndex !== index) setDragOverIndex(index);
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
    setCreateForm(getEmptySponsorForm());
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

  function closeEditModal() {
    if (editing || editLoading) return;
    setShowEditModal(false);
    setEditingSponsorId(null);
    setEditForm(getEmptySponsorForm());
    setEditLogoFile(null);
    setEditLogoPreview(null);
  }

  function openDeleteModal(sponsor: SponsorRow) {
    setDeleteTarget(sponsor);
    setShowDeleteModal(true);
    setError(null);
    setSuccessMessage(null);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setShowDeleteModal(false);
    setDeleteTarget(null);
  }

  function openDeleteAllModal() {
    if (sponsors.length === 0) return;
    setShowDeleteAllModal(true);
    setError(null);
    setSuccessMessage(null);
  }

  function closeDeleteAllModal() {
    if (deletingAll) return;
    setShowDeleteAllModal(false);
  }

  function updateCreateForm<K extends keyof SponsorForm>(
    key: K,
    value: SponsorForm[K]
  ) {
    setCreateForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "sponsorship_type") {
        next.sponsorship_type = normalizeSponsorType(String(value));
        if (normalizeSponsorType(String(value)) !== SPONSOR_TYPE_STORY) {
          next.slug = "";
        } else if (!next.slug.trim() && next.sponsor_name.trim()) {
          next.slug = slugify(next.sponsor_name);
        }
      }

      if (key === "sponsor_name") {
        const nextName = String(value);
        if (isStorySponsorType(next.sponsorship_type) && !current.slug.trim()) {
          next.slug = slugify(nextName);
        }
      }

      return next;
    });
  }

  function updateEditForm<K extends keyof SponsorForm>(
    key: K,
    value: SponsorForm[K]
  ) {
    setEditForm((current) => {
      const next = { ...current, [key]: value };

      if (key === "sponsorship_type") {
        next.sponsorship_type = normalizeSponsorType(String(value));
        if (normalizeSponsorType(String(value)) !== SPONSOR_TYPE_STORY) {
          next.slug = "";
        } else if (!next.slug.trim() && next.sponsor_name.trim()) {
          next.slug = slugify(next.sponsor_name);
        }
      }

      if (key === "sponsor_name") {
        const nextName = String(value);
        if (isStorySponsorType(next.sponsorship_type) && !current.slug.trim()) {
          next.slug = slugify(nextName);
        }
      }

      return next;
    });
  }

  async function handleCreateSponsor(e: React.FormEvent) {
    e.preventDefault();

    try {
      setCreating(true);
      setError(null);
      setSuccessMessage(null);

      const sponsorName = createForm.sponsor_name.trim();
      const contactName = createForm.contact_name.trim();
      const email = createForm.email.trim().toLowerCase();
      const phone = createForm.phone.trim();
      const sponsorType = normalizeSponsorType(createForm.sponsorship_type);
      const website = createForm.website.trim();
      const story = createForm.story.trim();
      const notes = createForm.notes.trim();
      const addressLine1 = createForm.address_line1.trim();
      const addressLine2 = createForm.address_line2.trim();
      const city = createForm.city.trim();
      const county = createForm.county.trim();
      const postcode = createForm.postcode.trim();
      const country = createForm.country.trim();
      const slug =
        sponsorType === SPONSOR_TYPE_STORY && createForm.slug.trim()
          ? createForm.slug.trim()
          : sponsorType === SPONSOR_TYPE_STORY
            ? slugify(sponsorName)
            : "";

      if (!sponsorName) throw new Error("Sponsor name is required.");
      if (!contactName) throw new Error("Contact name is required.");
      if (!email) throw new Error("Email is required.");
      if (!sponsorType) throw new Error("Sponsorship type is required.");
      if (sponsorType === SPONSOR_TYPE_STORY && !story) {
        throw new Error("Story is required for Story sponsors.");
      }

      const formData = new FormData();
      formData.append("sponsor_name", sponsorName);
      formData.append("contact_name", contactName);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("sponsorship_type", sponsorType);
      formData.append("website", website);
      formData.append("story", story);
      formData.append("notes", notes);
      formData.append("slug", slug);
      formData.append("address_line1", addressLine1);
      formData.append("address_line2", addressLine2);
      formData.append("city", city);
      formData.append("county", county);
      formData.append("postcode", postcode);
      formData.append("country", country);

      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const res = await fetch("/api/admin/sponsors/create", {
        method: "POST",
        body: formData,
      });

      const data: ApiResponse = await parseJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to create sponsor");
      }

      const createdSponsor: SponsorRow = data.sponsor
        ? {
            id: String(data.sponsor.id),
            sponsor_name: data.sponsor.sponsor_name ?? sponsorName,
            sponsorship_type: normalizeSponsorType(
              data.sponsor.sponsorship_type ?? sponsorType
            ),
            logo_link: data.sponsor.logo_link ?? null,
            story: data.sponsor.story ?? (story || null),
            slug: data.sponsor.slug ?? (slug || null),
            display_order:
              typeof data.sponsor.display_order === "number"
                ? data.sponsor.display_order
                : sponsors.length + 1,
          }
        : {
            id: crypto.randomUUID(),
            sponsor_name: sponsorName,
            sponsorship_type: sponsorType,
            logo_link: logoPreview,
            story: story || null,
            slug: slug || null,
            display_order: sponsors.length + 1,
          };

      setSponsors((current) => [...current, createdSponsor]);
      setShowCreateModal(false);
      setLogoFile(null);
      setLogoPreview(null);
      setCreateForm(getEmptySponsorForm());
      setSuccessMessage("Sponsor created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sponsor");
    } finally {
      setCreating(false);
    }
  }

  async function openEditModal(sponsorId: string) {
    try {
      setEditLoading(true);
      setError(null);
      setSuccessMessage(null);
      setEditingSponsorId(sponsorId);
      setShowEditModal(true);

      const res = await fetch(`/api/admin/sponsors/${sponsorId}`, {
        cache: "no-store",
      });

      const data: ApiResponse = await parseJsonResponse(res);

      if (!res.ok || !data.ok || !data.sponsor) {
        throw new Error(data.error || "Failed to load sponsor details");
      }

      const mappedForm = sponsorPayloadToForm(data.sponsor);

      setEditForm(mappedForm);
      setEditLogoFile(null);
      setEditLogoPreview(data.sponsor.logo_link ?? null);
    } catch (err) {
      setShowEditModal(false);
      setEditingSponsorId(null);
      setEditForm(getEmptySponsorForm());
      setEditLogoFile(null);
      setEditLogoPreview(null);
      setError(
        err instanceof Error ? err.message : "Failed to load sponsor details"
      );
    } finally {
      setEditLoading(false);
    }
  }

  async function handleUpdateSponsor(e: React.FormEvent) {
    e.preventDefault();

    if (!editingSponsorId) return;

    try {
      setEditing(true);
      setError(null);
      setSuccessMessage(null);

      const sponsorName = editForm.sponsor_name.trim();
      const contactName = editForm.contact_name.trim();
      const email = editForm.email.trim().toLowerCase();
      const phone = editForm.phone.trim();
      const sponsorType = normalizeSponsorType(editForm.sponsorship_type);
      const website = editForm.website.trim();
      const story = editForm.story.trim();
      const notes = editForm.notes.trim();
      const addressLine1 = editForm.address_line1.trim();
      const addressLine2 = editForm.address_line2.trim();
      const city = editForm.city.trim();
      const county = editForm.county.trim();
      const postcode = editForm.postcode.trim();
      const country = editForm.country.trim();
      const slug =
        sponsorType === SPONSOR_TYPE_STORY && editForm.slug.trim()
          ? editForm.slug.trim()
          : sponsorType === SPONSOR_TYPE_STORY
            ? slugify(sponsorName)
            : "";

      if (!sponsorName) throw new Error("Sponsor name is required.");
      if (!contactName) throw new Error("Contact name is required.");
      if (!email) throw new Error("Email is required.");
      if (!sponsorType) throw new Error("Sponsorship type is required.");
      if (sponsorType === SPONSOR_TYPE_STORY && !story) {
        throw new Error("Story is required for Story sponsors.");
      }

      const formData = new FormData();
      formData.append("sponsor_name", sponsorName);
      formData.append("contact_name", contactName);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("sponsorship_type", sponsorType);
      formData.append("website", website);
      formData.append("story", story);
      formData.append("notes", notes);
      formData.append("slug", slug);
      formData.append("address_line1", addressLine1);
      formData.append("address_line2", addressLine2);
      formData.append("city", city);
      formData.append("county", county);
      formData.append("postcode", postcode);
      formData.append("country", country);

      if (editLogoFile) {
        formData.append("logo", editLogoFile);
      }

      const res = await fetch(`/api/admin/sponsors/${editingSponsorId}`, {
        method: "PUT",
        body: formData,
      });

      const data: ApiResponse = await parseJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update sponsor");
      }

      const returned = data.sponsor;

      setSponsors((current) =>
        current.map((item) =>
          item.id === editingSponsorId
            ? {
                ...item,
                sponsor_name: returned?.sponsor_name ?? sponsorName,
                sponsorship_type: normalizeSponsorType(
                  returned?.sponsorship_type ?? sponsorType
                ),
                logo_link:
                  returned?.logo_link ??
                  (editLogoFile ? editLogoPreview : item.logo_link),
                story: returned?.story ?? (story || null),
                slug: returned?.slug ?? (slug || null),
              }
            : item
        )
      );

      setShowEditModal(false);
      setEditingSponsorId(null);
      setEditForm(getEmptySponsorForm());
      setEditLogoFile(null);
      setEditLogoPreview(null);
      setSuccessMessage("Sponsor updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sponsor");
    } finally {
      setEditing(false);
    }
  }

  async function handleDeleteSponsor() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      setError(null);
      setSuccessMessage(null);

      const res = await fetch(`/api/admin/sponsors/${deleteTarget.id}`, {
        method: "DELETE",
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to delete sponsor");
      }

      setSponsors((current) =>
        current.filter((item) => item.id !== deleteTarget.id)
      );

      setSuccessMessage(`"${deleteTarget.sponsor_name}" deleted successfully.`);
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete sponsor");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteAllSponsors() {
    try {
      setDeletingAll(true);
      setError(null);
      setSuccessMessage(null);

      const currentSponsors = [...sponsors];

      for (const sponsor of currentSponsors) {
        const res = await fetch(`/api/admin/sponsors/${sponsor.id}`, {
          method: "DELETE",
        });

        const data = await parseJsonResponse(res);

        if (!res.ok || !data?.ok) {
          throw new Error(
            data?.error || `Failed to delete sponsor "${sponsor.sponsor_name}"`
          );
        }
      }

      setSponsors([]);
      setSuccessMessage("All sponsors deleted successfully.");
      setShowDeleteAllModal(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete all sponsors"
      );
    } finally {
      setDeletingAll(false);
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

  async function handleExportToExcel() {
    try {
      setExporting(true);
      setError(null);
      setSuccessMessage(null);

      if (sponsors.length === 0) {
        throw new Error("There are no sponsors to export.");
      }

      const detailedSponsors = await Promise.all(
        sponsors.map(async (sponsor, index) => {
          try {
            const res = await fetch(`/api/admin/sponsors/${sponsor.id}`, {
              cache: "no-store",
            });

            const data: ApiResponse = await parseJsonResponse(res);

            if (!res.ok || !data.ok || !data.sponsor) {
              return {
                submitted_at: "",
                sponsor_name: sponsor.sponsor_name ?? "",
                contact_name: "",
                email: "",
                phone: "",
                sponsorship_type: getSponsorTypeLabel(sponsor.sponsorship_type),
                story: sponsor.story ?? "",
                address_line1: "",
                address_line2: "",
                city: "",
                county: "",
                postcode: "",
                country: "",
                google_maps: "",
                logo_link: sponsor.logo_link ?? "",
                website: "",
                slug: sponsor.slug ?? "",
                display_order: sponsor.display_order ?? index + 1,
              };
            }

            const full = data.sponsor;

            const addressParts = [
              full.address_line1 ?? "",
              full.address_line2 ?? "",
              full.city ?? "",
              full.county ?? "",
              full.postcode ?? "",
              full.country ?? "",
            ]
              .map((part) => String(part).trim())
              .filter(Boolean);

            const googleMaps =
              addressParts.length > 0
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    addressParts.join(", ")
                  )}`
                : "";

            return {
              submitted_at: formatSubmittedAt(full.created_at),
              sponsor_name: full.sponsor_name ?? "",
              contact_name: full.contact_name ?? "",
              email: full.email ?? "",
              phone: full.phone ?? "",
              sponsorship_type: getSponsorTypeLabel(full.sponsorship_type),
              story: full.story ?? "",
              address_line1: full.address_line1 ?? "",
              address_line2: full.address_line2 ?? "",
              city: full.city ?? "",
              county: full.county ?? "",
              postcode: full.postcode ?? "",
              country: full.country ?? "",
              google_maps: googleMaps,
              logo_link: full.logo_link ?? "",
              website: full.website ?? "",
              slug: full.slug ?? "",
              display_order:
                typeof full.display_order === "number"
                  ? full.display_order
                  : index + 1,
            };
          } catch {
            return {
              submitted_at: "",
              sponsor_name: sponsor.sponsor_name ?? "",
              contact_name: "",
              email: "",
              phone: "",
              sponsorship_type: getSponsorTypeLabel(sponsor.sponsorship_type),
              story: sponsor.story ?? "",
              address_line1: "",
              address_line2: "",
              city: "",
              county: "",
              postcode: "",
              country: "",
              google_maps: "",
              logo_link: sponsor.logo_link ?? "",
              website: "",
              slug: sponsor.slug ?? "",
              display_order: sponsor.display_order ?? index + 1,
            };
          }
        })
      );

      const headers = [
        "Submitted At",
        "Sponsor Name",
        "Contact Name",
        "Email",
        "Phone",
        "Sponsorship Type",
        "Story",
        "Address Line 1",
        "Address Line 2",
        "City / Town",
        "County",
        "Postcode",
        "Country",
        "Google Maps",
        "Logo Link",
        "Website",
        "Slug",
        "Display Order",
      ];

      const rows = detailedSponsors.map((item) => [
        item.submitted_at,
        item.sponsor_name,
        item.contact_name,
        item.email,
        item.phone,
        item.sponsorship_type,
        item.story,
        item.address_line1,
        item.address_line2,
        item.city,
        item.county,
        item.postcode,
        item.country,
        item.google_maps,
        item.logo_link,
        item.website,
        item.slug,
        item.display_order,
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 30 },
        { wch: 22 },
        { wch: 28 },
        { wch: 18 },
        { wch: 24 },
        { wch: 34 },
        { wch: 22 },
        { wch: 20 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 28 },
        { wch: 44 },
        { wch: 28 },
        { wch: 22 },
        { wch: 14 },
      ];

      worksheet["!rows"] = [{ hpt: 24 }, ...rows.map(() => ({ hpt: 22 }))];

      worksheet["!autofilter"] = {
        ref: `A1:R${rows.length + 1}`,
      };

      (worksheet as any)["!freeze"] = {
        xSplit: 0,
        ySplit: 1,
        topLeftCell: "A2",
        activePane: "bottomLeft",
        state: "frozen",
      };

      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

      const headerStyle = {
        fill: {
          patternType: "solid",
          fgColor: { rgb: "7C3AED" },
          bgColor: { rgb: "7C3AED" },
        },
        font: {
          bold: true,
          color: { rgb: "FFFFFF" },
          sz: 11,
          name: "Calibri",
        },
        alignment: {
          horizontal: "center",
          vertical: "center",
          wrapText: true,
        },
        border: {
          top: { style: "thin", color: { rgb: "D8B4FE" } },
          bottom: { style: "thin", color: { rgb: "D8B4FE" } },
          left: { style: "thin", color: { rgb: "D8B4FE" } },
          right: { style: "thin", color: { rgb: "D8B4FE" } },
        },
      };

      const bodyStyle = {
        font: {
          sz: 10,
          color: { rgb: "111827" },
          name: "Calibri",
        },
        alignment: {
          vertical: "top",
          horizontal: "left",
          wrapText: true,
        },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } },
        },
      };

      const linkStyle = {
        font: {
          sz: 10,
          color: { rgb: "2563EB" },
          underline: true,
          name: "Calibri",
        },
        alignment: {
          vertical: "top",
          horizontal: "left",
          wrapText: true,
        },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } },
        },
      };

      const centerStyle = {
        font: {
          sz: 10,
          color: { rgb: "111827" },
          name: "Calibri",
        },
        alignment: {
          vertical: "center",
          horizontal: "center",
          wrapText: true,
        },
        border: {
          top: { style: "thin", color: { rgb: "E5E7EB" } },
          bottom: { style: "thin", color: { rgb: "E5E7EB" } },
          left: { style: "thin", color: { rgb: "E5E7EB" } },
          right: { style: "thin", color: { rgb: "E5E7EB" } },
        },
      };

      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
        if (worksheet[cellRef]) {
          worksheet[cellRef].s = headerStyle;
        }
      }

      for (let row = 1; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellRef]) continue;

          if (col === 17) {
            worksheet[cellRef].s = centerStyle;
          } else {
            worksheet[cellRef].s = bodyStyle;
          }
        }
      }

      const linkColumns = [13, 14, 15];

      for (let row = 1; row <= range.e.r; row++) {
        for (const col of linkColumns) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellRef];
          if (!cell || !cell.v) continue;

          const value = String(cell.v).trim();
          if (!value) continue;

          cell.l = { Target: value, Tooltip: value };
          cell.s = linkStyle;
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sponsors");

      XLSX.writeFile(
        workbook,
        `burton-pride-sponsors-${new Date().toISOString().slice(0, 10)}.xlsx`
      );

      setSuccessMessage("Sponsors exported to styled Excel successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export sponsors");
    } finally {
      setExporting(false);
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
                type="button"
                onClick={handleExportToExcel}
                disabled={loading || exporting || sponsors.length === 0}
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? "Exporting..." : "Export Styled Excel"}
              </button>

              <button
                type="button"
                onClick={openDeleteAllModal}
                disabled={loading || deletingAll || sponsors.length === 0}
                className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete All
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
                          {getSponsorTypeLabel(sponsor.sponsorship_type) || "Sponsor"}
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          Drag to reorder
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(sponsor.id)}
                        className="rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-2 font-medium text-white transition hover:bg-blue-500/20"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => openDeleteModal(sponsor)}
                        className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2 font-medium text-white transition hover:bg-red-500/20"
                      >
                        Delete
                      </button>

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
          <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#140727] p-6 shadow-2xl">
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
              <div className="grid gap-4 sm:grid-cols-2">
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

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={createForm.contact_name}
                    onChange={(e) =>
                      updateCreateForm("contact_name", e.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="Main contact name"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Email
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => updateCreateForm("email", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="name@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) => updateCreateForm("phone", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="Optional"
                  />
                </div>
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
                    <option value={SPONSOR_TYPE_NORMAL} className="text-black">
                      Normal Sponsorship
                    </option>
                    <option value={SPONSOR_TYPE_KIND} className="text-black">
                      Sponsorship in Kind
                    </option>
                    <option value={SPONSOR_TYPE_STORY} className="text-black">
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
                  onChange={(e) => updateCreateForm("website", e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                  placeholder="https://..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={createForm.address_line1}
                    onChange={(e) =>
                      updateCreateForm("address_line1", e.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="Building and street"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={createForm.address_line2}
                    onChange={(e) =>
                      updateCreateForm("address_line2", e.target.value)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    City
                  </label>
                  <input
                    type="text"
                    value={createForm.city}
                    onChange={(e) => updateCreateForm("city", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="Town or city"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    County
                  </label>
                  <input
                    type="text"
                    value={createForm.county}
                    onChange={(e) => updateCreateForm("county", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="County"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Postcode
                  </label>
                  <input
                    type="text"
                    value={createForm.postcode}
                    onChange={(e) => updateCreateForm("postcode", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="Postcode"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Country
                  </label>
                  <input
                    type="text"
                    value={createForm.country}
                    onChange={(e) => updateCreateForm("country", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="Country"
                  />
                </div>
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

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#140727] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Edit Sponsor</h2>
                <p className="mt-1 text-sm text-white/70">
                  Update sponsor details from the admin portal.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={editing || editLoading}
                className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            {editLoading ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-white/70">
                Loading sponsor details...
              </div>
            ) : (
              <form onSubmit={handleUpdateSponsor} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Sponsor Name
                    </label>
                    <input
                      type="text"
                      value={editForm.sponsor_name}
                      onChange={(e) =>
                        updateEditForm("sponsor_name", e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="Burton Pride Sponsor"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={editForm.contact_name}
                      onChange={(e) =>
                        updateEditForm("contact_name", e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="Main contact name"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => updateEditForm("email", e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="name@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => updateEditForm("phone", e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div
                  className={`grid gap-4 ${
                    isEditStoryType ? "sm:grid-cols-2" : "sm:grid-cols-1"
                  }`}
                >
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Sponsor Type
                    </label>
                    <select
                      value={editForm.sponsorship_type}
                      onChange={(e) =>
                        updateEditForm("sponsorship_type", e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none"
                    >
                      <option value={SPONSOR_TYPE_NORMAL} className="text-black">
                        Normal Sponsorship
                      </option>
                      <option value={SPONSOR_TYPE_KIND} className="text-black">
                        Sponsorship in Kind
                      </option>
                      <option value={SPONSOR_TYPE_STORY} className="text-black">
                        Story
                      </option>
                    </select>
                  </div>

                  {isEditStoryType && (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-white/80">
                        Slug
                      </label>
                      <input
                        type="text"
                        value={editForm.slug}
                        onChange={(e) => updateEditForm("slug", e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                        placeholder="burton-pride-sponsor"
                        required={isEditStoryType}
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
                      setEditLogoFile(file);
                    }}
                    className="block w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white/20 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-white/30"
                  />

                  {editLogoPreview ? (
                    <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-white">
                      <Image
                        src={editLogoPreview}
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
                    value={editForm.website}
                    onChange={(e) => updateEditForm("website", e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="https://..."
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={editForm.address_line1}
                      onChange={(e) =>
                        updateEditForm("address_line1", e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="Building and street"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={editForm.address_line2}
                      onChange={(e) =>
                        updateEditForm("address_line2", e.target.value)
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      City
                    </label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => updateEditForm("city", e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="Town or city"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      County
                    </label>
                    <input
                      type="text"
                      value={editForm.county}
                      onChange={(e) => updateEditForm("county", e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="County"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Postcode
                    </label>
                    <input
                      type="text"
                      value={editForm.postcode}
                      onChange={(e) => updateEditForm("postcode", e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="Postcode"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Country
                    </label>
                    <input
                      type="text"
                      value={editForm.country}
                      onChange={(e) => updateEditForm("country", e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="Country"
                    />
                  </div>
                </div>

                {isEditStoryType && (
                  <div className="rounded-2xl border border-pink-300/30 bg-pink-500/10 p-4">
                    <label className="mb-2 block text-sm font-semibold text-white/80">
                      Sponsor Story
                    </label>

                    <textarea
                      value={editForm.story}
                      onChange={(e) => updateEditForm("story", e.target.value)}
                      rows={6}
                      className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                      placeholder="Write the sponsor story here..."
                      required={isEditStoryType}
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
                    value={editForm.notes}
                    onChange={(e) => updateEditForm("notes", e.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
                    placeholder="Add sponsor details, notes, or short description..."
                  />
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={editing}
                    className="rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/20 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={editing}
                    className="rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-3 font-semibold text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60"
                  >
                    {editing ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-red-400/20 bg-[#140727] p-6 shadow-2xl">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-white">Delete Sponsor</h2>
              <p className="mt-2 text-sm text-white/70">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-white">
                  {deleteTarget.sponsor_name}
                </span>
                ?
              </p>
              <p className="mt-2 text-sm text-red-200/90">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/20 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteSponsor}
                disabled={deleting}
                className="rounded-2xl border border-red-400/30 bg-red-500/20 px-5 py-3 font-semibold text-white hover:bg-red-500/30 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-3xl border border-red-400/20 bg-[#140727] p-6 shadow-2xl">
            <div className="mb-5">
              <h2 className="text-2xl font-bold text-white">Delete All Sponsors</h2>
              <p className="mt-2 text-sm text-white/70">
                Are you sure you want to delete all sponsors?
              </p>
              <p className="mt-2 text-sm text-red-200/90">
                This will remove every sponsor on this page and cannot be undone.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteAllModal}
                disabled={deletingAll}
                className="rounded-2xl bg-white/10 px-5 py-3 font-semibold text-white hover:bg-white/20 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteAllSponsors}
                disabled={deletingAll}
                className="rounded-2xl border border-red-400/30 bg-red-500/20 px-5 py-3 font-semibold text-white hover:bg-red-500/30 disabled:opacity-50"
              >
                {deletingAll ? "Deleting All..." : "Yes, Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}