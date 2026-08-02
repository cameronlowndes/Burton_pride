"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  ImageIcon,
  Loader2,
  Mail,
  Pause,
  Pencil,
  Play,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  SquareArrowOutUpRight,
  Trash2,
  UploadCloud,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Status = "pending" | "approved" | "rejected" | "hidden";

type ArtworkImage = {
  url: string;
  alt_text: string;
};

type Submission = {
  id: string;
  contact_name?: string | null;
  artist_name: string;
  pronouns: string;
  email: string;
  artwork_title: string;
  story: string;
  show_artist_name?: boolean;
  show_pronouns?: boolean;
  show_story?: boolean;
  show_image_descriptions?: boolean;
  no_ai_confirmed?: boolean;
  rights_confirmed?: boolean;
  public_consent?: boolean;
  terms_accepted?: boolean;
  alt_text?: string | null;
  alt_texts?: string[] | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  images?: ArtworkImage[];
  status: Status;
  featured: boolean;
  admin_notes: string | null;
  rejection_reason: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  created_at: string;
  updated_at?: string | null;
};

type ReviewAction = {
  submission: Submission;
  status: Status;
};

type EditSubmissionState = {
  submission: Submission;
  contactName: string;
  artistName: string;
  pronouns: string;
  email: string;
  artworkTitle: string;
  story: string;
  showArtistName: boolean;
  showPronouns: boolean;
  showStory: boolean;
  showImageDescriptions: boolean;
  noAiConfirmed: boolean;
  rightsConfirmed: boolean;
  publicConsent: boolean;
  termsAccepted: boolean;
  imageAltTexts: string[];
};

type AdminArtworkImage = {
  id: string;
  file: File;
  previewUrl: string;
  altText: string;
};

type AdminAddArtworkState = {
  contactName: string;
  artistName: string;
  pronouns: string;
  email: string;
  artworkTitle: string;
  story: string;
  showArtistName: boolean;
  showPronouns: boolean;
  showStory: boolean;
  showImageDescriptions: boolean;
  noAiConfirmed: boolean;
  rightsConfirmed: boolean;
  publicConsent: boolean;
  termsAccepted: boolean;
  status: "pending" | "approved";
  featured: boolean;
};

const emptyAdminArtwork: AdminAddArtworkState = {
  contactName: "",
  artistName: "",
  pronouns: "",
  email: "",
  artworkTitle: "",
  story: "",
  showArtistName: true,
  showPronouns: true,
  showStory: true,
  showImageDescriptions: true,
  noAiConfirmed: false,
  rightsConfirmed: false,
  publicConsent: false,
  termsAccepted: false,
  status: "pending",
  featured: false,
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

const statusOptions: Array<{
  value: Status | "all";
  label: string;
  icon: typeof Clock3;
}> = [
  { value: "pending", label: "Pending", icon: Clock3 },
  { value: "approved", label: "Approved", icon: CheckCircle2 },
  { value: "rejected", label: "Rejected", icon: XCircle },
  { value: "hidden", label: "Hidden", icon: EyeOff },
  { value: "all", label: "All", icon: ImageIcon },
];

function normaliseImages(submission: Submission): ArtworkImage[] {
  if (Array.isArray(submission.images) && submission.images.length > 0) {
    return submission.images.filter((image) => Boolean(image?.url));
  }

  const urls = Array.isArray(submission.image_urls)
    ? submission.image_urls.filter(Boolean)
    : submission.image_url
      ? [submission.image_url]
      : [];

  const altTexts = Array.isArray(submission.alt_texts)
    ? submission.alt_texts
    : [];

  return urls.map((url, index) => ({
    url,
    alt_text:
      altTexts[index] ||
      submission.alt_text ||
      `${submission.artwork_title}, artwork ${index + 1}`,
  }));
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClasses(status: Status) {
  if (status === "approved") {
    return "border-emerald-300/40 bg-emerald-500/15 text-emerald-100";
  }

  if (status === "rejected") {
    return "border-red-300/40 bg-red-500/15 text-red-100";
  }

  if (status === "hidden") {
    return "border-white/25 bg-white/10 text-white";
  }

  return "border-yellow-300/40 bg-yellow-300/15 text-yellow-100";
}

function getDeclarationItems(submission: Submission) {
  return [
    {
      key: "no_ai_confirmed",
      label: "Human-created artwork declaration",
      detail:
        "The artist confirmed the artwork is not fully or mainly AI-generated.",
      confirmed: Boolean(submission.no_ai_confirmed),
    },
    {
      key: "rights_confirmed",
      label: "Copyright and permission declaration",
      detail:
        "The artist confirmed they created the work or have permission to submit it.",
      confirmed: Boolean(submission.rights_confirmed),
    },
    {
      key: "public_consent",
      label: "Permission to publish",
      detail:
        "The artist gave Burton Pride permission to display the approved content.",
      confirmed: Boolean(submission.public_consent),
    },
    {
      key: "terms_accepted",
      label: "Community Art terms accepted",
      detail:
        "The artist accepted the Burton Pride Community Art Terms and Conditions.",
      confirmed: Boolean(submission.terms_accepted),
    },
  ];
}

function hasAllRequiredDeclarations(submission: Submission) {
  return getDeclarationItems(submission).every((item) => item.confirmed);
}

async function readPayload(
  response: Response,
): Promise<ApiErrorPayload | null> {
  const contentType = response.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      return payload && typeof payload === "object"
        ? (payload as ApiErrorPayload)
        : null;
    }

    const raw = (await response.text()).trim();

    if (
      contentType.includes("text/html") ||
      /^<!doctype html/i.test(raw) ||
      /^<html/i.test(raw)
    ) {
      return {
        message:
          response.status === 404
            ? "The admin Community Art API route does not exist."
            : "The server returned an HTML error page instead of JSON.",
      };
    }

    return raw ? { message: raw.slice(0, 500) } : null;
  } catch {
    return null;
  }
}

function buildApiError(
  response: Response,
  payload: ApiErrorPayload | null,
  action: string,
) {
  const serverMessage =
    payload?.error ||
    payload?.message ||
    "The server did not provide an error message.";

  const lines = [
    `Action: ${action}`,
    `Endpoint: ${new URL(response.url).pathname}`,
    `Status code: ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
    payload?.code ? `Error code: ${payload.code}` : "",
    `Server message: ${serverMessage}`,
    payload?.details ? `Details: ${payload.details}` : "",
    payload?.hint ? `Server hint: ${payload.hint}` : "",
    "",
    "What this means:",
  ].filter(Boolean);

  if (response.status === 401) {
    lines.push("Your admin session is missing or has expired.");
  } else if (response.status === 403) {
    lines.push(
      "Your admin account does not have permission to manage Community Art.",
    );
  } else if (response.status === 404) {
    lines.push(
      "The admin API route or requested submission could not be found.",
    );
  } else if (response.status >= 500) {
    lines.push(
      "The request reached the server, but the server could not complete it.",
    );
  } else {
    lines.push("The request could not be completed.");
  }

  lines.push("", "What to check:");

  if (response.status === 401) {
    lines.push(
      "1. Sign in to the admin portal again.",
      "2. Check the admin session cookie is being created.",
      "3. Check getCurrentAdmin() works in the API route.",
    );
  } else if (response.status === 404) {
    lines.push(
      "1. Confirm app/api/admin/community-art/route.ts exists.",
      "2. Confirm the page is calling /api/admin/community-art.",
      "3. Restart the Next.js development server after adding the route.",
    );
  } else if (response.status >= 500) {
    lines.push(
      "1. Check the terminal or deployment logs.",
      "2. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      "3. Check the community_art_submissions table columns.",
      "4. Check the community-art storage bucket exists.",
    );
  } else {
    lines.push(
      "1. Review the selected submission.",
      "2. Refresh the page and try again.",
    );
  }

  return lines.join("\n");
}

function unexpectedError(error: unknown, action: string) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "An unknown browser error occurred.";

  return [
    `Action: ${action}`,
    `Browser message: ${message}`,
    "",
    "What this means:",
    "The browser could not complete the admin request.",
    "",
    "What to check:",
    "1. Check the browser console and Network tab.",
    "2. Check the Next.js server is running.",
    "3. Check the admin API route exists.",
  ].join("\n");
}

export default function AdminCommunityArtPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [status, setStatus] = useState<Status | "all">("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState<ReviewAction | null>(null);
  const [preview, setPreview] = useState<Submission | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [slideshowPlaying, setSlideshowPlaying] = useState(true);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [featured, setFeatured] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [addArtworkOpen, setAddArtworkOpen] = useState(false);
  const [addArtwork, setAddArtwork] =
    useState<AdminAddArtworkState>(emptyAdminArtwork);
  const [addArtworkImages, setAddArtworkImages] = useState<AdminArtworkImage[]>(
    [],
  );
  const [editSubmission, setEditSubmission] =
    useState<EditSubmissionState | null>(null);

  async function loadSubmissions() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/community-art?status=${encodeURIComponent(status)}`,
        { cache: "no-store" },
      );
      const payload = await readPayload(response);

      if (!response.ok) {
        throw new Error(
          buildApiError(
            response,
            payload,
            `Load ${status === "all" ? "all" : status} Community Art submissions`,
          ),
        );
      }

      const result = payload as
        | (ApiErrorPayload & { submissions?: Submission[] })
        | null;

      setSubmissions(
        Array.isArray(result?.submissions) ? result.submissions : [],
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error &&
          caughtError.message.startsWith("Action:")
          ? caughtError.message
          : unexpectedError(caughtError, "Load Community Art submissions"),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSubmissions();
  }, [status]);

  useEffect(() => {
    const modalOpen = Boolean(
      review || preview || deleteTarget || editSubmission || addArtworkOpen,
    );
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || busyId) return;
      setReview(null);
      setPreview(null);
      setDeleteTarget(null);
      setEditSubmission(null);
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [review, preview, deleteTarget, editSubmission, addArtworkOpen, busyId]);

  useEffect(() => {
    setActiveSlide(0);
    setSlideshowPlaying(true);
  }, [preview?.id]);

  const previewImages = useMemo(
    () => (preview ? normaliseImages(preview) : []),
    [preview],
  );

  useEffect(() => {
    if (!preview || !slideshowPlaying || previewImages.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % previewImages.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [preview, previewImages.length, slideshowPlaying]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return submissions;

    return submissions.filter((item) =>
      [
        item.contact_name || "",
        item.artist_name,
        item.pronouns,
        item.email,
        item.artwork_title,
        item.story,
        item.admin_notes || "",
        item.rejection_reason || "",
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, submissions]);

  const counts = useMemo(() => {
    return {
      total: submissions.length,
      featured: submissions.filter((item) => item.featured).length,
      multiImage: submissions.filter((item) => normaliseImages(item).length > 1)
        .length,
      awaiting: submissions.filter((item) => item.status === "pending").length,
    };
  }, [submissions]);

  function openReview(submission: Submission, nextStatus: Status) {
    if (nextStatus === "approved" && !hasAllRequiredDeclarations(submission)) {
      const missing = getDeclarationItems(submission)
        .filter((item) => !item.confirmed)
        .map((item) => `• ${item.label}`)
        .join("\n");

      setError(
        [
          "Action: Approve Community Art submission",
          "",
          "Approval blocked:",
          "The artist declarations and permissions are not complete.",
          "",
          "Missing confirmations:",
          missing,
          "",
          "Open Edit submission and only tick a missing confirmation after Burton Pride has received clear written confirmation from the artist.",
        ].join("\n"),
      );
      return;
    }

    setReview({ submission, status: nextStatus });
    setNotes(submission.admin_notes || "");
    setRejectionReason(submission.rejection_reason || "");
    setFeatured(nextStatus === "approved" ? submission.featured : false);
    setError("");
  }

  function openEditSubmission(submission: Submission) {
    const images = normaliseImages(submission);

    setEditSubmission({
      submission,
      contactName: submission.contact_name || "",
      artistName: submission.artist_name || "",
      pronouns: submission.pronouns || "",
      email: submission.email || "",
      artworkTitle: submission.artwork_title || "",
      story: submission.story || "",
      showArtistName: submission.show_artist_name !== false,
      showPronouns: submission.show_pronouns !== false,
      showStory: submission.show_story !== false,
      showImageDescriptions: submission.show_image_descriptions !== false,
      noAiConfirmed: Boolean(submission.no_ai_confirmed),
      rightsConfirmed: Boolean(submission.rights_confirmed),
      publicConsent: Boolean(submission.public_consent),
      termsAccepted: Boolean(submission.terms_accepted),
      imageAltTexts: images.map((image) => image.alt_text || ""),
    });
    setError("");
  }

  function updateEditField<K extends keyof EditSubmissionState>(
    key: K,
    value: EditSubmissionState[K],
  ) {
    setEditSubmission((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  async function saveEditedSubmission() {
    if (!editSubmission) return;

    const requiredTextFields = [
      ["Contact name", editSubmission.contactName],
      ["Artist name", editSubmission.artistName],
      ["Email", editSubmission.email],
      ["Artwork title", editSubmission.artworkTitle],
      ["Story", editSubmission.story],
    ] as const;

    const missing = requiredTextFields
      .filter(([, value]) => !value.trim())
      .map(([label]) => label);

    if (missing.length > 0) {
      setError(
        `Action: Edit Community Art submission\n\nComplete these required fields:\n${missing
          .map((item) => `• ${item}`)
          .join("\n")}`,
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editSubmission.email.trim())) {
      setError(
        "Action: Edit Community Art submission\n\nEnter a valid email address.",
      );
      return;
    }

    setBusyId(editSubmission.submission.id);
    setError("");

    try {
      const response = await fetch("/api/admin/community-art", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editSubmission.submission.id,
          action: "edit_submission",
          contactName: editSubmission.contactName.trim(),
          artistName: editSubmission.artistName.trim(),
          pronouns: editSubmission.pronouns.trim(),
          email: editSubmission.email.trim(),
          artworkTitle: editSubmission.artworkTitle.trim(),
          story: editSubmission.story.trim(),
          showArtistName: editSubmission.showArtistName,
          showPronouns: editSubmission.showPronouns,
          showStory: editSubmission.showStory,
          showImageDescriptions: editSubmission.showImageDescriptions,
          noAiConfirmed: editSubmission.noAiConfirmed,
          rightsConfirmed: editSubmission.rightsConfirmed,
          publicConsent: editSubmission.publicConsent,
          termsAccepted: editSubmission.termsAccepted,
          imageAltTexts: editSubmission.imageAltTexts.map((item) =>
            item.trim(),
          ),
        }),
      });
      const payload = await readPayload(response);

      if (!response.ok) {
        throw new Error(
          buildApiError(response, payload, "Edit Community Art submission"),
        );
      }

      setEditSubmission(null);
      await loadSubmissions();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error &&
          caughtError.message.startsWith("Action:")
          ? caughtError.message
          : unexpectedError(caughtError, "Edit Community Art submission"),
      );
    } finally {
      setBusyId("");
    }
  }

  function updateAddArtwork<K extends keyof AdminAddArtworkState>(
    key: K,
    value: AdminAddArtworkState[K],
  ) {
    setAddArtwork((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function addAdminArtworkFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    if (addArtworkImages.length + incoming.length > 8) {
      setError("Admin artwork can contain a maximum of 8 images.");
      return;
    }
    const invalid = incoming.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          file.type,
        ),
    );
    if (invalid) {
      setError(
        `Unsupported image: ${invalid.name}. Use JPG, PNG, WEBP or GIF.`,
      );
      return;
    }
    const large = incoming.find((file) => file.size > 8 * 1024 * 1024);
    if (large) {
      setError(`${large.name} is larger than 8MB.`);
      return;
    }
    setAddArtworkImages((current) => [
      ...current,
      ...incoming.map((file) => ({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        altText: "",
      })),
    ]);
  }

  function closeAddArtwork() {
    if (busyId && busyId !== "admin-add-artwork") return;
    addArtworkImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setAddArtworkImages([]);
    setAddArtwork(emptyAdminArtwork);
    setAddArtworkOpen(false);
  }

  async function createAdminArtwork() {
    const declarationsComplete =
      addArtwork.noAiConfirmed &&
      addArtwork.rightsConfirmed &&
      addArtwork.publicConsent &&
      addArtwork.termsAccepted;
    if (
      !addArtwork.contactName.trim() ||
      !addArtwork.artistName.trim() ||
      !addArtwork.email.trim() ||
      !addArtwork.artworkTitle.trim() ||
      addArtwork.story.trim().length < 20
    ) {
      setError(
        "Complete the contact name, artist name, email, title and artist story before adding the artwork.",
      );
      return;
    }
    if (!declarationsComplete) {
      setError(
        "All four artist declarations must be confirmed before an admin can add this submission.",
      );
      return;
    }
    setBusyId("admin-add-artwork");
    setError("");
    try {
      const body = new FormData();
      body.append("action", "admin_create");
      body.append("contactName", addArtwork.contactName.trim());
      body.append("artistName", addArtwork.artistName.trim());
      body.append("pronouns", addArtwork.pronouns.trim());
      body.append("email", addArtwork.email.trim());
      body.append("artworkTitle", addArtwork.artworkTitle.trim());
      body.append("story", addArtwork.story.trim());
      body.append("showArtistName", String(addArtwork.showArtistName));
      body.append("showPronouns", String(addArtwork.showPronouns));
      body.append("showStory", String(addArtwork.showStory));
      body.append(
        "showImageDescriptions",
        String(addArtwork.showImageDescriptions),
      );
      body.append("noAiConfirmed", String(addArtwork.noAiConfirmed));
      body.append("rightsConfirmed", String(addArtwork.rightsConfirmed));
      body.append("publicConsent", String(addArtwork.publicConsent));
      body.append("termsAccepted", String(addArtwork.termsAccepted));
      body.append("status", addArtwork.status);
      body.append("featured", String(addArtwork.featured));
      body.append(
        "imageAltTexts",
        JSON.stringify(addArtworkImages.map((image) => image.altText.trim())),
      );
      addArtworkImages.forEach((image) => body.append("images", image.file));
      const response = await fetch("/api/admin/community-art", {
        method: "POST",
        body,
      });
      const payload = await readPayload(response);
      if (!response.ok)
        throw new Error(
          buildApiError(
            response,
            payload,
            "Add Community Art from admin portal",
          ),
        );
      closeAddArtwork();
      await loadSubmissions();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error &&
          caughtError.message.startsWith("Action:")
          ? caughtError.message
          : unexpectedError(caughtError, "Add Community Art from admin portal"),
      );
    } finally {
      setBusyId("");
    }
  }

  async function saveReview() {
    if (!review) return;

    if (review.status === "rejected" && rejectionReason.trim().length < 5) {
      setError(
        [
          "Action: Reject Community Art submission",
          "",
          "What this means:",
          "A clear rejection reason is required before the submission can be rejected.",
          "",
          "What to check:",
          "1. Enter a short explanation for the artist.",
          "2. Use at least 5 characters.",
        ].join("\n"),
      );
      return;
    }

    setBusyId(review.submission.id);
    setError("");

    try {
      const response = await fetch("/api/admin/community-art", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: review.submission.id,
          status: review.status,
          featured,
          adminNotes: notes.trim(),
          rejectionReason: rejectionReason.trim(),
        }),
      });
      const payload = await readPayload(response);

      if (!response.ok) {
        throw new Error(
          buildApiError(
            response,
            payload,
            `${review.status} Community Art submission`,
          ),
        );
      }

      setReview(null);
      await loadSubmissions();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error &&
          caughtError.message.startsWith("Action:")
          ? caughtError.message
          : unexpectedError(caughtError, "Update Community Art submission"),
      );
    } finally {
      setBusyId("");
    }
  }

  async function deleteSubmission() {
    if (!deleteTarget) return;

    setBusyId(deleteTarget.id);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/community-art?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      const payload = await readPayload(response);

      if (!response.ok) {
        throw new Error(
          buildApiError(
            response,
            payload,
            "Permanently delete Community Art submission",
          ),
        );
      }

      setDeleteTarget(null);
      await loadSubmissions();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error &&
          caughtError.message.startsWith("Action:")
          ? caughtError.message
          : unexpectedError(caughtError, "Delete Community Art submission"),
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-4 pb-10 pt-24 text-white sm:px-7 sm:pt-28 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl bg-gradient-to-r from-fuchsia-700 via-purple-700 to-indigo-700 p-6 text-white shadow-xl sm:p-8"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-black uppercase tracking-wide">
                <ShieldCheck className="h-4 w-4" />
                Website moderation
              </p>

              <h1 className="mt-4 text-3xl font-black sm:text-5xl">
                Community Art Submissions
              </h1>

              <p className="mt-3 max-w-3xl text-white/85">
                Review artwork collections, inspect every image, approve work
                for the public gallery, reject it with a reason, hide published
                submissions or permanently remove them.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap lg:max-w-xl lg:justify-end">
              <button
                type="button"
                onClick={() => setAddArtworkOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-300 px-5 py-3 font-black text-purple-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-white"
              >
                <PlusCircle className="h-5 w-5" />
                Add artwork
              </button>

              <Link
                href="/Admin/Dashboard/CommunityArt/TermsAcceptance"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-yellow-300/60 bg-yellow-300/15 px-5 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-yellow-300 hover:text-purple-950"
              >
                <FileText className="h-5 w-5" />
                Artist terms table
              </Link>

              <Link
                href="/CommunityArt"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-5 py-3 font-black text-white shadow-lg backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white hover:text-purple-800"
              >
                <Eye className="h-5 w-5" />
                View approved gallery
                <SquareArrowOutUpRight className="h-4 w-4" />
              </Link>

              <Link
                href="/CommunityArt/TermsAndConditions"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-5 py-3 font-black text-white shadow-lg backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white hover:text-purple-800"
              >
                <BookOpen className="h-5 w-5" />
                Read artist terms
                <SquareArrowOutUpRight className="h-4 w-4" />
              </Link>

              <button
                type="button"
                onClick={() => void loadSubmissions()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 font-black text-purple-800 shadow-lg transition hover:-translate-y-0.5 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh submissions
              </button>
            </div>
          </div>
        </motion.header>

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-red-950 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" />
              <div className="min-w-0">
                <h2 className="font-black">Community Art admin error</h2>
                <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm font-semibold leading-6">
                  {error}
                </pre>
              </div>
            </div>
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Showing",
              value: counts.total,
              detail: `${status === "all" ? "all statuses" : status} submissions`,
              icon: ImageIcon,
            },
            {
              label: "Awaiting review",
              value: counts.awaiting,
              detail: "pending in this view",
              icon: Clock3,
            },
            {
              label: "Featured",
              value: counts.featured,
              detail: "highlighted publicly",
              icon: Sparkles,
            },
            {
              label: "Collections",
              value: counts.multiImage,
              detail: "with multiple images",
              icon: FileText,
            },
          ].map(({ label, value, detail, icon: Icon }) => (
            <div
              key={label}
              className="rounded-3xl border border-white/20 bg-black/20 p-5 text-white shadow-lg backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-white/70">
                    {label}
                  </p>
                  <p className="mt-2 text-4xl font-black">{value}</p>
                  <p className="mt-1 text-sm font-semibold text-white/70">
                    {detail}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-yellow-300">
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-white/20 bg-black/20 p-5 shadow-lg backdrop-blur-md sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatus(option.value)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${
                      status === option.value
                        ? "bg-yellow-300 text-purple-950 shadow-md"
                        : "border border-white/15 bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <label className="relative block w-full xl:max-w-md">
              <span className="sr-only">Search submissions</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/65" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search artist, email, title or story"
                className="w-full rounded-2xl border border-white/25 bg-black/25 py-3 pl-12 pr-4 font-semibold text-white outline-none transition placeholder:text-white/55 focus:border-yellow-300 focus:ring-4 focus:ring-yellow-300/15"
              />
            </label>
          </div>
        </section>

        {loading ? (
          <div className="grid min-h-[420px] place-items-center text-center">
            <div>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-purple-700" />
              <p className="mt-4 font-black text-slate-700">
                Loading Community Art submissions…
              </p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6 grid min-h-[360px] place-items-center rounded-3xl border-2 border-dashed border-white/25 bg-black/15 px-6 text-center backdrop-blur-md">
            <div className="max-w-xl py-12">
              <ImageIcon className="mx-auto h-12 w-12 text-white/60" />
              <h2 className="mt-4 text-2xl font-black">No submissions found</h2>
              <p className="mt-2 text-white/75">
                There are no {status === "all" ? "" : status} submissions
                matching the current search.
              </p>
            </div>
          </div>
        ) : (
          <section className="mt-6 grid gap-5 xl:grid-cols-2">
            {filtered.map((submission) => {
              const images = normaliseImages(submission);
              const cover = images[0];
              const busy = busyId === submission.id;

              return (
                <article
                  key={submission.id}
                  className="overflow-hidden rounded-3xl border border-white/20 bg-black/20 text-white shadow-lg backdrop-blur-md"
                >
                  <div className="grid md:grid-cols-[220px_1fr]">
                    <button
                      type="button"
                      onClick={() => setPreview(submission)}
                      className="group relative min-h-56 overflow-hidden bg-slate-950 text-left"
                    >
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover.url}
                          alt={cover.alt_text}
                          className="h-full min-h-56 w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full min-h-56 place-items-center text-white/60">
                          <ImageIcon className="h-12 w-12" />
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-16 text-white">
                        <p className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-black backdrop-blur-sm">
                          <Eye className="h-3.5 w-3.5" />
                          Review {images.length}{" "}
                          {images.length === 1 ? "image" : "images"}
                        </p>
                      </div>

                      {submission.featured ? (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-1.5 text-xs font-black text-purple-950 shadow-lg">
                          <Sparkles className="h-3.5 w-3.5" />
                          Featured
                        </span>
                      ) : null}
                    </button>

                    <div className="p-5 text-white">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClasses(
                              submission.status,
                            )}`}
                          >
                            {submission.status}
                          </span>

                          <h2 className="mt-3 text-2xl font-black leading-tight">
                            {submission.artwork_title}
                          </h2>
                        </div>

                        <p className="text-right text-xs font-semibold text-white/60">
                          Submitted
                          <br />
                          {formatDate(submission.created_at)}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        <p className="flex items-center gap-2">
                          <UserRound className="h-4 w-4 text-yellow-300" />
                          <strong className="text-white">
                            {submission.artist_name}
                          </strong>
                          {submission.pronouns
                            ? ` • ${submission.pronouns}`
                            : ""}
                        </p>

                        <a
                          href={`mailto:${submission.email}`}
                          className="flex items-center gap-2 font-semibold text-yellow-300 hover:underline"
                        >
                          <Mail className="h-4 w-4" />
                          {submission.email}
                        </a>
                      </div>

                      <p className="mt-4 line-clamp-3 leading-relaxed text-white/75">
                        {submission.story}
                      </p>

                      {submission.admin_notes ? (
                        <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-3 text-sm text-white/80">
                          <p className="font-black">Private admin notes</p>
                          <p className="mt-1 line-clamp-2">
                            {submission.admin_notes}
                          </p>
                        </div>
                      ) : null}

                      {submission.rejection_reason ? (
                        <div className="mt-4 rounded-2xl border border-red-300/40 bg-red-500/15 p-3 text-sm text-red-100">
                          <p className="font-black">Rejection reason</p>
                          <p className="mt-1 line-clamp-2">
                            {submission.rejection_reason}
                          </p>
                        </div>
                      ) : null}

                      <div
                        className={`mt-4 rounded-2xl border p-3 text-sm ${
                          hasAllRequiredDeclarations(submission)
                            ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
                            : "border-amber-300/40 bg-amber-500/15 text-amber-100"
                        }`}
                      >
                        <p className="flex items-center gap-2 font-black">
                          {hasAllRequiredDeclarations(submission) ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          Artist declarations and permissions
                        </p>
                        <p className="mt-1">
                          {
                            getDeclarationItems(submission).filter(
                              (item) => item.confirmed,
                            ).length
                          }
                          /{getDeclarationItems(submission).length} confirmed
                        </p>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setPreview(submission)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white px-4 py-2.5 text-sm font-black text-purple-800 shadow-md transition hover:bg-yellow-300 hover:text-purple-950"
                        >
                          <Eye className="h-4 w-4" />
                          Full review
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditSubmission(submission)}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white hover:text-purple-800 disabled:opacity-60"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit submission
                        </button>

                        {submission.status !== "approved" ? (
                          <button
                            type="button"
                            onClick={() => openReview(submission, "approved")}
                            disabled={
                              busy || !hasAllRequiredDeclarations(submission)
                            }
                            title={
                              !hasAllRequiredDeclarations(submission)
                                ? "Complete all artist declarations and permissions before approval."
                                : undefined
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-emerald-400 hover:text-emerald-950 disabled:opacity-60"
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </button>
                        ) : null}

                        {submission.status !== "rejected" ? (
                          <button
                            type="button"
                            onClick={() => openReview(submission, "rejected")}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-red-400 hover:text-red-950 disabled:opacity-60"
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </button>
                        ) : null}

                        {submission.status !== "hidden" ? (
                          <button
                            type="button"
                            onClick={() => openReview(submission, "hidden")}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-slate-800 px-4 py-2.5 text-sm font-black text-white shadow-md transition hover:bg-slate-700 disabled:opacity-60"
                          >
                            <EyeOff className="h-4 w-4" />
                            Hide
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(submission)}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-300/40 bg-red-500/15 px-4 py-2.5 text-sm font-black text-red-100 transition hover:bg-red-500 hover:text-white disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>

      <AnimatePresence>
        {preview && previewImages.length > 0 ? (
          <motion.div
            className="fixed inset-0 z-[300] overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-md sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setPreview(null);
            }}
          >
            <div className="grid min-h-full place-items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 12 }}
                className="relative my-6 w-full max-w-7xl overflow-hidden rounded-3xl bg-white text-slate-950 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="absolute right-4 top-4 z-30 rounded-full bg-black/65 p-3 text-white transition hover:bg-fuchsia-600"
                  aria-label="Close full review"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="grid xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="bg-slate-950 p-3 sm:p-5">
                    <div className="relative grid min-h-[360px] place-items-center overflow-hidden rounded-2xl bg-black sm:min-h-[620px]">
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={`${preview.id}-${activeSlide}`}
                          src={previewImages[activeSlide].url}
                          alt={previewImages[activeSlide].alt_text}
                          initial={{ opacity: 0, scale: 0.985 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.015 }}
                          className="max-h-[78vh] w-full object-contain"
                        />
                      </AnimatePresence>

                      {previewImages.length > 1 ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSlide(
                                (activeSlide - 1 + previewImages.length) %
                                  previewImages.length,
                              )
                            }
                            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/65 p-3 text-white transition hover:bg-white hover:text-slate-950"
                          >
                            <ChevronLeft className="h-6 w-6" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveSlide(
                                (activeSlide + 1) % previewImages.length,
                              )
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/65 p-3 text-white transition hover:bg-white hover:text-slate-950"
                          >
                            <ChevronRight className="h-6 w-6" />
                          </button>

                          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-sm font-black text-white backdrop-blur-md">
                            <button
                              type="button"
                              onClick={() =>
                                setSlideshowPlaying((current) => !current)
                              }
                              className="rounded-full p-1 hover:bg-white/20"
                            >
                              {slideshowPlaying ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                            {activeSlide + 1} / {previewImages.length}
                          </div>
                        </>
                      ) : null}
                    </div>

                    {previewImages.length > 1 ? (
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {previewImages.map((image, index) => (
                          <button
                            key={`${image.url}-${index}`}
                            type="button"
                            onClick={() => {
                              setActiveSlide(index);
                              setSlideshowPlaying(false);
                            }}
                            className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-2 ${
                              activeSlide === index
                                ? "ring-yellow-300"
                                : "ring-white/20"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image.url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="max-h-[92vh] overflow-y-auto p-6 text-slate-950 sm:p-9">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${statusClasses(
                        preview.status,
                      )}`}
                    >
                      {preview.status}
                    </span>

                    <h2
                      id="preview-title"
                      className="mt-4 text-3xl font-black sm:text-5xl"
                    >
                      {preview.artwork_title}
                    </h2>

                    <p className="mt-3 text-lg font-black text-fuchsia-700">
                      {preview.artist_name}
                      {preview.pronouns ? (
                        <span className="font-semibold text-slate-500">
                          {" "}
                          • {preview.pronouns}
                        </span>
                      ) : null}
                    </p>

                    <a
                      href={`mailto:${preview.email}`}
                      className="mt-3 inline-flex items-center gap-2 font-bold text-purple-700 hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {preview.email}
                    </a>

                    <div className="mt-6 rounded-2xl bg-slate-100 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Image description {activeSlide + 1}
                      </p>
                      <p className="mt-2 leading-relaxed text-slate-700">
                        {previewImages[activeSlide].alt_text}
                      </p>
                    </div>

                    <div className="mt-6 border-l-4 border-fuchsia-600 pl-5">
                      <p className="whitespace-pre-wrap leading-8 text-slate-700">
                        {preview.story}
                      </p>
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-slate-900">
                            Artist declarations and permissions
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Approval is only available when every required item
                            is confirmed.
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            hasAllRequiredDeclarations(preview)
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {
                            getDeclarationItems(preview).filter(
                              (item) => item.confirmed,
                            ).length
                          }
                          /{getDeclarationItems(preview).length}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {getDeclarationItems(preview).map((item) => (
                          <div
                            key={item.key}
                            className={`flex gap-3 rounded-xl border p-3 ${
                              item.confirmed
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-red-200 bg-red-50"
                            }`}
                          >
                            {item.confirmed ? (
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                            ) : (
                              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
                            )}
                            <div>
                              <p className="font-black text-slate-900">
                                {item.label}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {item.detail}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
                      <p>
                        <strong className="text-slate-900">Submitted:</strong>{" "}
                        {formatDate(preview.created_at)}
                      </p>
                      <p>
                        <strong className="text-white">Reviewed:</strong>{" "}
                        {formatDate(preview.reviewed_at)}
                      </p>
                      <p>
                        <strong className="text-white">Reviewed by:</strong>{" "}
                        {preview.reviewed_by || "Not reviewed"}
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const current = preview;
                          setPreview(null);
                          openEditSubmission(current);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-3 font-black text-white"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit submission
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!hasAllRequiredDeclarations(preview)) {
                            openReview(preview, "approved");
                            return;
                          }
                          setPreview(null);
                          openReview(preview, "approved");
                        }}
                        disabled={!hasAllRequiredDeclarations(preview)}
                        title={
                          !hasAllRequiredDeclarations(preview)
                            ? "Complete all artist declarations and permissions first."
                            : undefined
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPreview(null);
                          openReview(preview, "rejected");
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-black text-white"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPreview(null);
                          openReview(preview, "hidden");
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-3 font-black text-white"
                      >
                        <EyeOff className="h-4 w-4" />
                        Hide
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {review ? (
          <motion.div
            className="fixed inset-0 z-[310] overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target && !busyId) {
                setReview(null);
              }
            }}
          >
            <div className="grid min-h-full place-items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="relative my-6 w-full max-w-2xl rounded-3xl bg-white p-6 text-slate-950 shadow-2xl sm:p-8"
              >
                <button
                  type="button"
                  onClick={() => setReview(null)}
                  disabled={Boolean(busyId)}
                  className="absolute right-4 top-4 rounded-full bg-slate-100 p-3 transition hover:bg-slate-200 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>

                <p className="text-sm font-black uppercase tracking-wide text-purple-700">
                  Moderation action
                </p>

                <h2
                  id="review-title"
                  className="mt-2 pr-12 text-3xl font-black"
                >
                  {review.status === "approved"
                    ? "Approve artwork"
                    : review.status === "rejected"
                      ? "Reject artwork"
                      : "Hide artwork"}
                </h2>

                <p className="mt-2 text-white/75">
                  {review.submission.artwork_title} by{" "}
                  <strong>{review.submission.artist_name}</strong>
                </p>

                {review.status === "approved" ? (
                  <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-yellow-50 p-4">
                    <input
                      type="checkbox"
                      checked={featured}
                      onChange={(event) => setFeatured(event.target.checked)}
                      className="mt-1 h-5 w-5 accent-purple-700"
                    />
                    <span>
                      <strong className="block">Feature this submission</strong>
                      <span className="text-sm text-slate-600">
                        Featured artwork can be highlighted more prominently in
                        the public gallery.
                      </span>
                    </span>
                  </label>
                ) : null}

                {review.status === "rejected" ? (
                  <label className="mt-6 block">
                    <span className="mb-2 block font-black">
                      Rejection reason *
                    </span>
                    <textarea
                      value={rejectionReason}
                      onChange={(event) =>
                        setRejectionReason(event.target.value.slice(0, 1000))
                      }
                      rows={5}
                      placeholder="Explain clearly why this submission cannot be published."
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                    />
                    <span className="mt-1 block text-right text-xs font-semibold text-slate-400">
                      {rejectionReason.length}/1,000
                    </span>
                  </label>
                ) : null}

                <label className="mt-6 block">
                  <span className="mb-2 block font-black">
                    Private admin notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value.slice(0, 2000))
                    }
                    rows={5}
                    placeholder="Add internal notes. These are never shown publicly."
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                  />
                  <span className="mt-1 block text-right text-xs font-semibold text-slate-400">
                    {notes.length}/2,000
                  </span>
                </label>

                <div className="mt-7 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReview(null)}
                    disabled={Boolean(busyId)}
                    className="rounded-xl bg-slate-100 px-5 py-3 font-black text-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveReview()}
                    disabled={Boolean(busyId)}
                    className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-black text-white disabled:opacity-60 ${
                      review.status === "approved"
                        ? "bg-emerald-600"
                        : review.status === "rejected"
                          ? "bg-red-600"
                          : "bg-slate-700"
                    }`}
                  >
                    {busyId ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : review.status === "approved" ? (
                      <Check className="h-5 w-5" />
                    ) : review.status === "rejected" ? (
                      <X className="h-5 w-5" />
                    ) : (
                      <EyeOff className="h-5 w-5" />
                    )}
                    Confirm action
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editSubmission ? (
          <motion.div
            className="fixed inset-0 z-[315] overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-md sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-submission-title"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target && !busyId) {
                setEditSubmission(null);
              }
            }}
          >
            <div className="grid min-h-full place-items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 18 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 12 }}
                className="relative my-6 w-full max-w-5xl overflow-hidden rounded-3xl bg-white text-slate-950 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => setEditSubmission(null)}
                  disabled={Boolean(busyId)}
                  className="absolute right-4 top-4 z-20 rounded-full bg-black/55 p-3 text-white transition hover:bg-fuchsia-700 disabled:opacity-50"
                  aria-label="Close edit submission"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="bg-gradient-to-r from-fuchsia-700 via-purple-700 to-indigo-700 px-6 py-7 text-white sm:px-9">
                  <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide">
                    <Pencil className="h-4 w-4" />
                    Admin editing
                  </p>
                  <h2
                    id="edit-submission-title"
                    className="mt-4 pr-12 text-3xl font-black sm:text-4xl"
                  >
                    Edit submitted artwork
                  </h2>
                  <p className="mt-2 max-w-3xl text-white/85">
                    Correct submission details, public display choices and
                    optional image descriptions. Only change an artist
                    declaration after receiving clear written confirmation.
                  </p>
                </div>

                <div className="grid gap-7 p-6 sm:p-9 lg:grid-cols-2">
                  <div className="space-y-5">
                    <label className="block">
                      <span className="mb-2 block text-sm font-black">
                        Private contact name *
                      </span>
                      <input
                        value={editSubmission.contactName}
                        onChange={(event) =>
                          updateEditField("contactName", event.target.value)
                        }
                        maxLength={100}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                      />
                      <span className="mt-1 block text-xs text-slate-500">
                        Never shown publicly.
                      </span>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-black">
                        Public artist name *
                      </span>
                      <input
                        value={editSubmission.artistName}
                        onChange={(event) =>
                          updateEditField("artistName", event.target.value)
                        }
                        maxLength={100}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                      />
                    </label>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-black">
                          Pronouns
                        </span>
                        <input
                          value={editSubmission.pronouns}
                          onChange={(event) =>
                            updateEditField("pronouns", event.target.value)
                          }
                          maxLength={60}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-black">
                          Email *
                        </span>
                        <input
                          type="email"
                          value={editSubmission.email}
                          onChange={(event) =>
                            updateEditField("email", event.target.value)
                          }
                          maxLength={200}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-black">
                        Artwork or collection title *
                      </span>
                      <input
                        value={editSubmission.artworkTitle}
                        onChange={(event) =>
                          updateEditField("artworkTitle", event.target.value)
                        }
                        maxLength={120}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 flex justify-between gap-3 text-sm font-black">
                        <span>Artist story *</span>
                        <span className="text-xs text-slate-400">
                          {editSubmission.story.length}/2,000
                        </span>
                      </span>
                      <textarea
                        value={editSubmission.story}
                        onChange={(event) =>
                          updateEditField(
                            "story",
                            event.target.value.slice(0, 2000),
                          )
                        }
                        rows={8}
                        className="w-full resize-y rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                      />
                    </label>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5">
                      <h3 className="font-black text-fuchsia-950">
                        Public display choices
                      </h3>
                      <p className="mt-1 text-sm text-fuchsia-900/75">
                        These control what visitors see in the public gallery.
                      </p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {[
                          ["showArtistName", "Show artist name"],
                          ["showPronouns", "Show pronouns"],
                          ["showStory", "Show story"],
                          ["showImageDescriptions", "Show image descriptions"],
                        ].map(([key, label]) => (
                          <label
                            key={key}
                            className="flex cursor-pointer items-center gap-3 rounded-xl border border-fuchsia-200 bg-white p-3"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(
                                editSubmission[
                                  key as
                                    | "showArtistName"
                                    | "showPronouns"
                                    | "showStory"
                                    | "showImageDescriptions"
                                ],
                              )}
                              onChange={(event) =>
                                updateEditField(
                                  key as
                                    | "showArtistName"
                                    | "showPronouns"
                                    | "showStory"
                                    | "showImageDescriptions",
                                  event.target.checked,
                                )
                              }
                              className="h-5 w-5 accent-fuchsia-700"
                            />
                            <span className="text-sm font-black">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <div>
                          <h3 className="font-black text-amber-950">
                            Artist declarations and permissions
                          </h3>
                          <p className="mt-1 text-sm leading-relaxed text-amber-900">
                            Do not tick these on the artist’s behalf unless
                            Burton Pride has received clear written
                            confirmation. Record the evidence in the private
                            admin notes when approving.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {[
                          [
                            "noAiConfirmed",
                            "Human-created artwork declaration",
                          ],
                          [
                            "rightsConfirmed",
                            "Copyright and permission declaration",
                          ],
                          ["publicConsent", "Permission to publish"],
                          ["termsAccepted", "Community Art terms accepted"],
                        ].map(([key, label]) => (
                          <label
                            key={key}
                            className="flex cursor-pointer gap-3 rounded-xl border border-amber-200 bg-white p-3"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(
                                editSubmission[
                                  key as
                                    | "noAiConfirmed"
                                    | "rightsConfirmed"
                                    | "publicConsent"
                                    | "termsAccepted"
                                ],
                              )}
                              onChange={(event) =>
                                updateEditField(
                                  key as
                                    | "noAiConfirmed"
                                    | "rightsConfirmed"
                                    | "publicConsent"
                                    | "termsAccepted",
                                  event.target.checked,
                                )
                              }
                              className="mt-0.5 h-5 w-5 accent-purple-700"
                            />
                            <span className="text-sm font-black text-slate-800">
                              {label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-5">
                      <h3 className="font-black">Image descriptions</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Descriptions are optional. When supplied, keep them
                        accurate and useful for accessibility.
                      </p>

                      <div className="mt-4 space-y-4">
                        {normaliseImages(editSubmission.submission).map(
                          (image, index) => (
                            <div
                              key={`${image.url}-${index}`}
                              className="grid gap-3 rounded-xl bg-slate-100 p-3 sm:grid-cols-[90px_1fr]"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={image.url}
                                alt=""
                                className="h-24 w-full rounded-lg object-cover"
                              />
                              <label>
                                <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
                                  Image {index + 1}
                                </span>
                                <textarea
                                  value={
                                    editSubmission.imageAltTexts[index] || ""
                                  }
                                  onChange={(event) => {
                                    const next =
                                      editSubmission.imageAltTexts.slice();
                                    next[index] = event.target.value.slice(
                                      0,
                                      300,
                                    );
                                    updateEditField("imageAltTexts", next);
                                  }}
                                  rows={3}
                                  maxLength={300}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-100"
                                />
                              </label>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end sm:px-9">
                  <button
                    type="button"
                    onClick={() => setEditSubmission(null)}
                    disabled={Boolean(busyId)}
                    className="rounded-xl bg-slate-100 px-5 py-3 font-black text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveEditedSubmission()}
                    disabled={Boolean(busyId)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-5 py-3 font-black text-white shadow-lg transition hover:bg-purple-600 disabled:opacity-60"
                  >
                    {busyId ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    Save submission changes
                  </button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {addArtworkOpen ? (
          <motion.div
            className="fixed inset-0 z-[315] overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-md sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-add-artwork-title"
          >
            <div className="grid min-h-full place-items-center">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
                className="relative my-6 w-full max-w-6xl overflow-hidden rounded-3xl bg-white text-slate-950 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={closeAddArtwork}
                  disabled={Boolean(busyId)}
                  className="absolute right-4 top-4 z-20 rounded-full bg-black/60 p-3 text-white hover:bg-fuchsia-700 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="bg-gradient-to-r from-fuchsia-700 via-purple-700 to-indigo-700 p-7 text-white sm:p-9">
                  <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide">
                    <ShieldCheck className="h-4 w-4" /> Admin entry
                  </p>
                  <h2
                    id="admin-add-artwork-title"
                    className="mt-4 pr-12 text-3xl font-black sm:text-5xl"
                  >
                    Add artwork in the admin portal
                  </h2>
                  <p className="mt-3 max-w-3xl text-white/85">
                    Only add artwork after the artist has confirmed every
                    declaration and permission. Admins can save it for review or
                    publish it immediately.
                  </p>
                </div>
                <div className="grid gap-7 p-6 lg:grid-cols-2 sm:p-9">
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-black">
                          Private contact name *
                        </span>
                        <input
                          value={addArtwork.contactName}
                          onChange={(e) =>
                            updateAddArtwork("contactName", e.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-black">
                          Public artist name *
                        </span>
                        <input
                          value={addArtwork.artistName}
                          onChange={(e) =>
                            updateAddArtwork("artistName", e.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-black">
                          Pronouns
                        </span>
                        <input
                          value={addArtwork.pronouns}
                          onChange={(e) =>
                            updateAddArtwork("pronouns", e.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-black">
                          Email *
                        </span>
                        <input
                          type="email"
                          value={addArtwork.email}
                          onChange={(e) =>
                            updateAddArtwork("email", e.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black">
                        Artwork or collection title *
                      </span>
                      <input
                        value={addArtwork.artworkTitle}
                        onChange={(e) =>
                          updateAddArtwork("artworkTitle", e.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-black">
                        Artist story *
                      </span>
                      <textarea
                        rows={6}
                        value={addArtwork.story}
                        onChange={(e) =>
                          updateAddArtwork(
                            "story",
                            e.target.value.slice(0, 2000),
                          )
                        }
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                      />
                    </label>
                    <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-5">
                      <h3 className="font-black">What visitors can see</h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {[
                          ["showArtistName", "Artist name"],
                          ["showPronouns", "Pronouns"],
                          ["showStory", "Artist story"],
                          ["showImageDescriptions", "Image descriptions"],
                        ].map(([key, label]) => (
                          <label
                            key={key}
                            className="flex gap-3 rounded-xl bg-white p-3"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(
                                addArtwork[key as keyof AdminAddArtworkState],
                              )}
                              onChange={(e) =>
                                updateAddArtwork(
                                  key as keyof AdminAddArtworkState,
                                  e.target.checked as never,
                                )
                              }
                              className="mt-1 h-5 w-5 accent-fuchsia-700"
                            />
                            <span className="font-bold">Show {label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-5">
                    <label className="block cursor-pointer rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-7 text-center hover:border-fuchsia-500">
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={(e) => {
                          addAdminArtworkFiles(e.target.files);
                          e.currentTarget.value = "";
                        }}
                      />
                      <UploadCloud className="mx-auto h-11 w-11 text-fuchsia-700" />
                      <p className="mt-3 font-black">
                        Add artwork images (optional)
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        You can add up to 8 images, 8MB each, or save the
                        submission without images.
                      </p>
                    </label>
                    <div className="space-y-3">
                      {addArtworkImages.map((image, index) => (
                        <div
                          key={image.id}
                          className="grid grid-cols-[90px_1fr_auto] gap-3 rounded-2xl border border-slate-200 p-3"
                        >
                          <img
                            src={image.previewUrl}
                            alt=""
                            className="h-24 w-24 rounded-xl object-cover"
                          />
                          <label className="block">
                            <span className="text-xs font-black">
                              Image {index + 1} description (optional)
                            </span>
                            <textarea
                              rows={3}
                              value={image.altText}
                              onChange={(e) =>
                                setAddArtworkImages((current) =>
                                  current.map((item) =>
                                    item.id === image.id
                                      ? {
                                          ...item,
                                          altText: e.target.value.slice(0, 300),
                                        }
                                      : item,
                                  ),
                                )
                              }
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(image.previewUrl);
                              setAddArtworkImages((current) =>
                                current.filter((item) => item.id !== image.id),
                              );
                            }}
                            className="self-start rounded-full bg-red-50 p-2 text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
                      <h3 className="font-black text-amber-950">
                        Artist declarations and permission
                      </h3>
                      <p className="mt-1 text-sm text-amber-900">
                        Tick these only when the artist has personally agreed or
                        you have written evidence.
                      </p>
                      <div className="mt-4 space-y-3">
                        {[
                          [
                            "noAiConfirmed",
                            "Artwork is human-created and not fully or mainly AI-generated",
                          ],
                          [
                            "rightsConfirmed",
                            "Artist owns the work or has permission to submit it",
                          ],
                          [
                            "publicConsent",
                            "Artist gives Burton Pride permission to publish the selected information",
                          ],
                          [
                            "termsAccepted",
                            "Artist has read and accepted the Community Art Terms and Conditions",
                          ],
                        ].map(([key, label]) => (
                          <label
                            key={key}
                            className="flex gap-3 rounded-xl bg-white p-3"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(
                                addArtwork[key as keyof AdminAddArtworkState],
                              )}
                              onChange={(e) =>
                                updateAddArtwork(
                                  key as keyof AdminAddArtworkState,
                                  e.target.checked as never,
                                )
                              }
                              className="mt-1 h-5 w-5 accent-emerald-700"
                            />
                            <span className="text-sm font-semibold">
                              {label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label>
                        <span className="mb-2 block text-sm font-black">
                          Save as
                        </span>
                        <select
                          value={addArtwork.status}
                          onChange={(e) =>
                            updateAddArtwork(
                              "status",
                              e.target.value as "pending" | "approved",
                            )
                          }
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                        >
                          <option value="pending">Pending review</option>
                          <option value="approved">Approved and public</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl bg-yellow-50 p-4">
                        <input
                          type="checkbox"
                          checked={addArtwork.featured}
                          onChange={(e) =>
                            updateAddArtwork("featured", e.target.checked)
                          }
                          className="h-5 w-5 accent-purple-700"
                        />
                        <span className="font-black">Feature artwork</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => void createAdminArtwork()}
                      disabled={Boolean(busyId)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-700 via-purple-700 to-indigo-700 px-6 py-4 text-lg font-black text-white disabled:opacity-60"
                    >
                      {busyId === "admin-add-artwork" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <PlusCircle className="h-5 w-5" />
                      )}{" "}
                      Add artwork
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget ? (
          <motion.div
            className="fixed inset-0 z-[320] grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-lg rounded-3xl bg-white p-6 text-slate-950 shadow-2xl sm:p-8"
            >
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-700">
                <Trash2 className="h-7 w-7" />
              </div>

              <h2
                id="delete-title"
                className="mt-5 text-center text-3xl font-black"
              >
                Permanently delete submission?
              </h2>

              <p className="mt-3 text-center leading-relaxed text-slate-600">
                This will delete <strong>{deleteTarget.artwork_title}</strong>,
                its database record and all stored images. This cannot be
                undone.
              </p>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={Boolean(busyId)}
                  className="rounded-xl bg-slate-100 px-5 py-3 font-black text-slate-700"
                >
                  Keep submission
                </button>

                <button
                  type="button"
                  onClick={() => void deleteSubmission()}
                  disabled={Boolean(busyId)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-black text-white disabled:opacity-60"
                >
                  {busyId ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Trash2 className="h-5 w-5" />
                  )}
                  Delete permanently
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
