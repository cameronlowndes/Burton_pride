"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageIcon,
  Loader2,
  Mail,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const MAX_IMAGES = 8;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = 40 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

type ArtworkImage = {
  url: string;
  alt_text: string;
};

type CommunityArtwork = {
  id: string;
  artwork_title: string;
  artist_name: string;
  pronouns: string;
  story: string;
  alt_text?: string | null;
  alt_texts?: string[] | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  images?: ArtworkImage[];
  featured: boolean;
  show_artist_name?: boolean | null;
  show_pronouns?: boolean | null;
  show_story?: boolean | null;
  show_image_descriptions?: boolean | null;
  approved_at: string | null;
  created_at: string;
};

type FormState = {
  artistName: string;
  publicArtistName: string;
  pronouns: string;
  email: string;
  artworkTitle: string;
  story: string;
  showArtistName: boolean;
  showPronouns: boolean;
  showStory: boolean;
  showImageDescriptions: boolean;
  publicConsent: boolean;
  rightsConfirmed: boolean;
  noAiConfirmed: boolean;
  termsAccepted: boolean;
  website: string;
};

type UploadArtwork = {
  id: string;
  file: File;
  previewUrl: string;
  altText: string;
};

const initialForm: FormState = {
  artistName: "",
  publicArtistName: "",
  pronouns: "",
  email: "",
  artworkTitle: "",
  story: "",
  showArtistName: true,
  showPronouns: true,
  showStory: true,
  showImageDescriptions: true,
  publicConsent: false,
  rightsConfirmed: false,
  noAiConfirmed: false,
  termsAccepted: false,
  website: "",
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  action?: string;
  endpoint?: string;
  statusCode?: number;
  field?: string;
  fieldErrors?: Record<string, string | string[]>;
};

function cleanErrorValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatFieldErrors(fieldErrors: ApiErrorPayload["fieldErrors"]) {
  if (!fieldErrors || typeof fieldErrors !== "object") return [];

  return Object.entries(fieldErrors).flatMap(([field, value]) => {
    const messages = Array.isArray(value) ? value : [value];

    return messages
      .map((message) => cleanErrorValue(message))
      .filter(Boolean)
      .map((message) => `${field}: ${message}`);
  });
}

function getStatusExplanation(status: number) {
  if (status === 400) {
    return "Some of the submitted information was missing or invalid.";
  }

  if (status === 401) {
    return "The request was not authorised. The public submission route may be incorrectly protected.";
  }

  if (status === 403) {
    return "The server refused this request. Check route permissions, storage policies and server-side validation.";
  }

  if (status === 404) {
    return "The Community Art API route or storage resource could not be found.";
  }

  if (status === 408) {
    return "The request took too long and timed out.";
  }

  if (status === 409) {
    return "The request conflicts with an existing submission or database record.";
  }

  if (status === 413) {
    return "The server rejected the upload because the request was too large.";
  }

  if (status === 415) {
    return "One or more uploaded files use a format the server does not accept.";
  }

  if (status === 429) {
    return "Too many requests were sent in a short period. Please wait before trying again.";
  }

  if (status >= 500) {
    return "The request reached the server, but the server could not complete it.";
  }

  return "The request could not be completed.";
}

function getStatusChecks(status: number) {
  if (status === 404) {
    return [
      "Confirm app/api/community-art/route.ts exists.",
      "Confirm the Supabase storage bucket name matches the API route.",
      "Confirm the deployed route uses the same URL as this page.",
    ];
  }

  if (status === 413) {
    return [
      "Reduce the number or size of the selected images.",
      "Check the hosting platform request-body limit.",
      "Check any reverse proxy or server upload limit.",
    ];
  }

  if (status === 415) {
    return [
      "Use JPG, PNG, WEBP or GIF files.",
      "Confirm the API route accepts the same MIME types as this page.",
    ];
  }

  if (status >= 500) {
    return [
      "Check the terminal or deployment server logs.",
      "Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      "Check the community_artworks and community_artwork_images table columns.",
      "Check the community-art storage bucket exists and uploads are allowed.",
    ];
  }

  return ["Review the highlighted form information.", "Try the request again."];
}

async function readApiPayload(
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

    const rawText = (await response.text()).trim();

    if (
      contentType.includes("text/html") ||
      /^<!doctype html/i.test(rawText) ||
      /^<html/i.test(rawText)
    ) {
      return {
        message:
          response.status === 404
            ? "The Community Art API route does not exist at this address."
            : "The server returned an HTML error page instead of an API response.",
      };
    }

    return rawText ? { message: rawText.slice(0, 500) } : null;
  } catch {
    return null;
  }
}

function buildApiErrorMessage({
  response,
  payload,
  action,
  fallback,
}: {
  response: Response;
  payload: ApiErrorPayload | null;
  action: string;
  fallback: string;
}) {
  const primaryMessage =
    cleanErrorValue(payload?.error) ||
    cleanErrorValue(payload?.message) ||
    fallback;

  const details = cleanErrorValue(payload?.details);
  const hint = cleanErrorValue(payload?.hint);
  const code = cleanErrorValue(payload?.code);
  const endpoint =
    cleanErrorValue(payload?.endpoint) ||
    (() => {
      try {
        return new URL(response.url).pathname;
      } catch {
        return "/api/community-art";
      }
    })();

  const lines = [
    `Action: ${cleanErrorValue(payload?.action) || action}`,
    `Endpoint: ${endpoint}`,
    `Status code: ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
    code ? `Error code: ${code}` : "",
    `Server message: ${primaryMessage}`,
    details ? `Details: ${details}` : "",
    hint ? `Server hint: ${hint}` : "",
  ].filter(Boolean);

  const fieldErrors = formatFieldErrors(payload?.fieldErrors);
  if (fieldErrors.length > 0) {
    lines.push(
      "",
      "Fields to correct:",
      ...fieldErrors.map((item) => `• ${item}`),
    );
  }

  lines.push(
    "",
    "What this means:",
    getStatusExplanation(response.status),
    "",
    "What to check:",
    ...getStatusChecks(response.status).map(
      (item, index) => `${index + 1}. ${item}`,
    ),
  );

  return lines.join("\n");
}

function getUnexpectedErrorMessage(error: unknown, action: string) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "An unknown browser error occurred.";

  const isNetworkFailure =
    error instanceof TypeError ||
    /failed to fetch|network|load failed|fetch/i.test(message);

  if (isNetworkFailure) {
    return [
      `Action: ${action}`,
      "Endpoint: /api/community-art",
      "Status code: No response received",
      `Browser message: ${message}`,
      "",
      "What this means:",
      "The browser could not connect to the Community Art API.",
      "",
      "What to check:",
      "1. Confirm the development server is running.",
      "2. Confirm the website and API are using the same domain and protocol.",
      "3. Check the browser console and Network tab.",
      "4. Check whether an ad blocker, firewall or browser extension blocked the request.",
      "5. Check the server terminal for a crash or failed build.",
    ].join("\n");
  }

  return [
    `Action: ${action}`,
    `Browser message: ${message}`,
    "",
    "What this means:",
    "The page encountered an unexpected error before the request completed.",
    "",
    "What to check:",
    "1. Check the browser console for the full error.",
    "2. Check the selected files and form information.",
    "3. Refresh the page and try again.",
  ].join("\n");
}

function validateSubmissionForm(
  form: FormState,
  uploadImages: UploadArtwork[],
) {
  const issues: string[] = [];

  if (!form.artistName.trim()) {
    issues.push("Enter your full name for Burton Pride to contact you.");
  } else if (form.artistName.trim().length > 100) {
    issues.push("Your full name must be 100 characters or fewer.");
  }

  if (form.showArtistName && !form.publicArtistName.trim()) {
    issues.push(
      "Enter the artist name you want visitors to see, or turn off ‘Show my artist name’.",
    );
  } else if (form.publicArtistName.trim().length > 100) {
    issues.push("Your public artist name must be 100 characters or fewer.");
  }

  if (!form.pronouns.trim()) {
    issues.push("Enter your pronouns.");
  } else if (form.pronouns.trim().length > 60) {
    issues.push("Pronouns must be 60 characters or fewer.");
  }

  const email = form.email.trim();
  if (!email) {
    issues.push("Enter your email address.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push("Enter a valid email address, such as name@example.com.");
  }

  if (!form.artworkTitle.trim()) {
    issues.push("Enter an artwork or collection title.");
  } else if (form.artworkTitle.trim().length > 120) {
    issues.push(
      "The artwork or collection title must be 120 characters or fewer.",
    );
  }

  if (form.story.trim().length < 20) {
    issues.push("Your story must be at least 20 characters.");
  } else if (form.story.trim().length > 2000) {
    issues.push("Your story must be 2,000 characters or fewer.");
  }

  if (uploadImages.length === 0) {
    issues.push("Choose at least one artwork image.");
  }

  if (uploadImages.length > MAX_IMAGES) {
    issues.push(`Choose no more than ${MAX_IMAGES} artwork images.`);
  }

  uploadImages.forEach((item, index) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(item.file.type)) {
      issues.push(
        `Artwork ${index + 1}, “${item.file.name}”, must be a JPG, PNG, WEBP or GIF.`,
      );
    }

    if (item.file.size > MAX_IMAGE_SIZE) {
      issues.push(
        `Artwork ${index + 1}, “${item.file.name}”, is ${formatFileSize(
          item.file.size,
        )}; each image must be 8MB or smaller.`,
      );
    }

    if (item.altText.trim().length < 10) {
      issues.push(
        `Add an image description of at least 10 characters for artwork ${
          index + 1
        }, “${item.file.name}”.`,
      );
    }
  });

  const totalSize = uploadImages.reduce(
    (total, item) => total + item.file.size,
    0,
  );

  if (totalSize > MAX_TOTAL_IMAGE_SIZE) {
    issues.push(
      `The selected images total ${formatFileSize(
        totalSize,
      )}; the combined limit is 40MB.`,
    );
  }

  if (!form.rightsConfirmed) {
    issues.push(
      "Confirm that you created the artwork or have permission to share it.",
    );
  }

  if (!form.noAiConfirmed) {
    issues.push(
      "Confirm that the submitted artwork is not fully or mainly AI-generated.",
    );
  }

  if (!form.termsAccepted) {
    issues.push(
      "Read and accept the Burton Pride Community Art Terms and Conditions.",
    );
  }

  if (!form.publicConsent) {
    issues.push(
      "Give Burton Pride permission to review and display the information you have chosen to make public.",
    );
  }

  if (form.website.trim()) {
    issues.push(
      "The anti-spam check was triggered. Clear the hidden website field and try again.",
    );
  }

  return issues;
}

function buildValidationErrorMessage(issues: string[]) {
  return [
    `Submission could not be sent because ${issues.length} ${
      issues.length === 1 ? "issue was" : "issues were"
    } found:`,
    "",
    ...issues.map((issue, index) => `${index + 1}. ${issue}`),
    "",
    "No files have been uploaded yet. Correct the information above and submit again.",
  ].join("\n");
}

function FieldLabel({
  children,
  required = false,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="mb-2 block text-sm font-black text-slate-900">
      {children}
      {required ? <span className="ml-1 text-fuchsia-700">*</span> : null}
    </span>
  );
}

function isPublicChoiceEnabled(value: boolean | null | undefined) {
  // Existing records created before public visibility controls were added
  // continue to display unless an artist has explicitly chosen "do not show".
  return value !== false;
}

function getPublicArtistName(artwork: CommunityArtwork) {
  return isPublicChoiceEnabled(artwork.show_artist_name)
    ? artwork.artist_name
    : "Anonymous artist";
}

function normaliseArtworkImages(artwork: CommunityArtwork): ArtworkImage[] {
  if (Array.isArray(artwork.images) && artwork.images.length > 0) {
    return artwork.images.filter((image) => Boolean(image?.url));
  }

  const urls = Array.isArray(artwork.image_urls)
    ? artwork.image_urls.filter(Boolean)
    : [];
  const altTexts = Array.isArray(artwork.alt_texts) ? artwork.alt_texts : [];

  if (urls.length > 0) {
    return urls.map((url, index) => ({
      url,
      alt_text:
        altTexts[index] ||
        artwork.alt_text ||
        `${artwork.artwork_title}, artwork ${index + 1}`,
    }));
  }

  if (artwork.image_url) {
    return [
      {
        url: artwork.image_url,
        alt_text: artwork.alt_text || artwork.artwork_title,
      },
    ];
  }

  return [];
}

function makeUploadId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function HomeClient() {
  const [artworks, setArtworks] = useState<CommunityArtwork[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedArtwork, setSelectedArtwork] =
    useState<CommunityArtwork | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [slideshowPlaying, setSlideshowPlaying] = useState(true);

  const [submitOpen, setSubmitOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [uploadImages, setUploadImages] = useState<UploadArtwork[]>([]);
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const submitDialogRef = useRef<HTMLDivElement | null>(null);
  const uploadImagesRef = useRef<UploadArtwork[]>([]);

  async function loadArtworks() {
    setGalleryLoading(true);
    setGalleryError("");

    try {
      const response = await fetch("/api/community-art", {
        method: "GET",
        cache: "no-store",
      });

      const result = await readApiPayload(response);

      if (!response.ok) {
        throw new Error(
          buildApiErrorMessage({
            response,
            payload: result,
            action: "Load approved community artwork",
            fallback: "The community art gallery could not be loaded.",
          }),
        );
      }

      const artworkPayload = result as
        (ApiErrorPayload & { artworks?: CommunityArtwork[] }) | null;

      setArtworks(
        Array.isArray(artworkPayload?.artworks) ? artworkPayload.artworks : [],
      );
    } catch (error) {
      setGalleryError(
        error instanceof Error && error.message.includes("Action:")
          ? error.message
          : getUnexpectedErrorMessage(error, "Load approved community artwork"),
      );
    } finally {
      setGalleryLoading(false);
    }
  }

  useEffect(() => {
    void loadArtworks();
  }, []);

  useEffect(() => {
    uploadImagesRef.current = uploadImages;
  }, [uploadImages]);

  useEffect(() => {
    return () => {
      uploadImagesRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    const modalOpen = Boolean(selectedArtwork || submitOpen);
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (selectedArtwork) {
        setSelectedArtwork(null);
      } else if (!submitting) {
        setSubmitOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedArtwork, submitOpen, submitting]);

  useEffect(() => {
    if (!submitOpen) return;
    window.setTimeout(() => submitDialogRef.current?.focus(), 50);
  }, [submitOpen]);

  useEffect(() => {
    setActiveSlide(0);
    setSlideshowPlaying(true);
  }, [selectedArtwork?.id]);

  const filteredArtworks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return artworks;

    return artworks.filter((artwork) =>
      [
        artwork.artwork_title,
        isPublicChoiceEnabled(artwork.show_artist_name)
          ? artwork.artist_name
          : "",
        isPublicChoiceEnabled(artwork.show_pronouns) ? artwork.pronouns : "",
        isPublicChoiceEnabled(artwork.show_story) ? artwork.story : "",
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [artworks, search]);

  const selectedImages = useMemo(
    () => (selectedArtwork ? normaliseArtworkImages(selectedArtwork) : []),
    [selectedArtwork],
  );

  useEffect(() => {
    if (!selectedArtwork || !slideshowPlaying || selectedImages.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % selectedImages.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [selectedArtwork, selectedImages.length, slideshowPlaying]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitted(false);
    setFormError("");
  }

  function openArtwork(artwork: CommunityArtwork) {
    setActiveSlide(0);
    setSlideshowPlaying(true);
    setSelectedArtwork(artwork);
  }

  function changeSlide(direction: number) {
    if (selectedImages.length <= 1) return;

    setActiveSlide((current) => {
      return (
        (current + direction + selectedImages.length) % selectedImages.length
      );
    });
  }

  function handleImageFiles(files: FileList | null) {
    setSubmitted(false);
    setFormError("");

    if (!files?.length) return;

    const incoming = Array.from(files);
    const availableSlots = MAX_IMAGES - uploadImages.length;

    if (availableSlots <= 0) {
      setFormError(`You can upload a maximum of ${MAX_IMAGES} artwork images.`);
      return;
    }

    if (incoming.length > availableSlots) {
      setFormError(
        `Only ${availableSlots} more image${availableSlots === 1 ? "" : "s"} can be added. The maximum is ${MAX_IMAGES}.`,
      );
      return;
    }

    const invalidType = incoming.find(
      (file) => !ACCEPTED_IMAGE_TYPES.includes(file.type),
    );

    if (invalidType) {
      setFormError(
        `“${invalidType.name}” is not supported. Please use JPG, PNG, WEBP or GIF images.`,
      );
      return;
    }

    const tooLarge = incoming.find((file) => file.size > MAX_IMAGE_SIZE);

    if (tooLarge) {
      setFormError(`“${tooLarge.name}” is larger than 8MB.`);
      return;
    }

    const currentTotal = uploadImages.reduce(
      (total, item) => total + item.file.size,
      0,
    );
    const incomingTotal = incoming.reduce(
      (total, file) => total + file.size,
      0,
    );

    if (currentTotal + incomingTotal > MAX_TOTAL_IMAGE_SIZE) {
      setFormError(
        "The total size of all artwork images must be 40MB or less.",
      );
      return;
    }

    const additions: UploadArtwork[] = incoming.map((file) => ({
      id: makeUploadId(),
      file,
      previewUrl: URL.createObjectURL(file),
      altText: "",
    }));

    setUploadImages((current) => [...current, ...additions]);
  }

  function removeUploadImage(id: string) {
    setUploadImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    setFormError("");
  }

  function updateUploadAltText(id: string, value: string) {
    setUploadImages((current) =>
      current.map((item) =>
        item.id === id ? { ...item, altText: value.slice(0, 300) } : item,
      ),
    );
    setFormError("");
  }

  function clearUploadImages() {
    uploadImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setUploadImages([]);
  }

  function resetSubmissionForm() {
    setForm(initialForm);
    clearUploadImages();
    setFormError("");
    setSubmitted(false);
    setSubmittedCount(0);
  }

  function openSubmitDialog() {
    setSubmitted(false);
    setFormError("");
    setSubmitOpen(true);
  }

  function closeSubmitDialog() {
    if (submitting) return;
    setSubmitOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSubmitted(false);

    const validationIssues = validateSubmissionForm(form, uploadImages);

    if (validationIssues.length > 0) {
      setFormError(buildValidationErrorMessage(validationIssues));
      return;
    }

    setSubmitting(true);

    try {
      const body = new FormData();
      body.append("contactName", form.artistName.trim());
      body.append(
        "artistName",
        form.showArtistName ? form.publicArtistName.trim() : "Anonymous artist",
      );
      body.append("publicArtistName", form.publicArtistName.trim());
      body.append("pronouns", form.pronouns.trim());
      body.append("email", form.email.trim());
      body.append("artworkTitle", form.artworkTitle.trim());
      body.append("story", form.story.trim());
      body.append("showArtistName", String(form.showArtistName));
      body.append("showPronouns", String(form.showPronouns));
      body.append("showStory", String(form.showStory));
      body.append("showImageDescriptions", String(form.showImageDescriptions));
      body.append("publicConsent", String(form.publicConsent));
      body.append("rightsConfirmed", String(form.rightsConfirmed));
      body.append("noAiConfirmed", String(form.noAiConfirmed));
      body.append("termsAccepted", String(form.termsAccepted));
      body.append("website", form.website);
      body.append(
        "imageAltTexts",
        JSON.stringify(uploadImages.map((item) => item.altText.trim())),
      );

      uploadImages.forEach((item) => {
        body.append("images", item.file);
      });

      // Backwards-compatible fields for an older single-image API route.
      body.append("image", uploadImages[0].file);
      body.append("altText", uploadImages[0].altText.trim());

      const response = await fetch("/api/community-art", {
        method: "POST",
        body,
      });

      const result = await readApiPayload(response);

      if (!response.ok) {
        throw new Error(
          buildApiErrorMessage({
            response,
            payload: result,
            action: `Submit ${uploadImages.length} community artwork ${
              uploadImages.length === 1 ? "image" : "images"
            }`,
            fallback: "Your artwork collection could not be submitted.",
          }),
        );
      }

      const numberSubmitted = uploadImages.length;
      setForm(initialForm);
      clearUploadImages();
      setSubmittedCount(numberSubmitted);
      setSubmitted(true);
    } catch (error) {
      setFormError(
        error instanceof Error && error.message.includes("Action:")
          ? error.message
          : getUnexpectedErrorMessage(
              error,
              `Submit ${uploadImages.length} community artwork ${
                uploadImages.length === 1 ? "image" : "images"
              }`,
            ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden text-white">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-24 sm:px-7 sm:pb-14 sm:pt-28 lg:px-10 lg:pb-16 lg:pt-28">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative overflow-hidden rounded-[2rem] border border-white/25 bg-black/10 px-5 py-8 text-center shadow-2xl backdrop-blur-md sm:px-9 sm:py-10 lg:px-12"
        >
          <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-pink-400/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-blue-400/35 blur-3xl" />

          <div className="relative mx-auto flex max-w-4xl flex-col items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.12, type: "spring", stiffness: 130 }}
              className="relative mb-5 h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-white shadow-2xl shadow-black/25 sm:h-32 sm:w-32"
            >
              <Image
                src="/image/Logo.png"
                alt="Burton Pride logo"
                fill
                priority
                sizes="128px"
                className="object-cover"
              />
            </motion.div>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.15em] backdrop-blur-sm sm:text-sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Created by our community
            </div>

            <h1 className="text-4xl font-black tracking-tight drop-shadow-md sm:text-5xl lg:text-6xl">
              Community Art Gallery
            </h1>

            <p className="mx-auto mt-4 max-w-3xl text-base font-medium leading-relaxed text-white/90 sm:text-lg">
              Explore artwork shared by LGBTQIA+ people and allies. Collections
              with several pieces open as a slideshow, alongside the artist’s
              name, pronouns and story.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#community-gallery"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-black text-fuchsia-700 shadow-xl transition hover:-translate-y-0.5 hover:bg-fuchsia-50"
              >
                <Heart className="h-5 w-5" aria-hidden="true" />
                Explore the gallery
              </a>

              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/DonateToUs"
                  className="rounded-full bg-yellow-300 px-8 py-4 text-lg font-black text-purple-950 shadow-2xl shadow-yellow-300/40 transition-transform hover:scale-105 hover:bg-white sm:px-10 sm:text-xl"
                >
                  💖 Please Consider Donating
                </Link>

                <button
                  type="button"
                  onClick={openSubmitDialog}
                  className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-6 py-3 font-black text-purple-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <UploadCloud className="h-5 w-5" aria-hidden="true" />
                  Submit up to {MAX_IMAGES} pieces
                </button>

                <Link
                  href="/CommunityArt/TermsAndConditions"
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/15 px-6 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-white/15"
                >
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  Read the art terms
                </Link>
              </div>
            </div>

            <div className="mt-7 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-3">
              {[
                "Upload one piece or a full collection",
                "Each image gets its own description",
                "Every submission is reviewed first",
              ].map((message) => (
                <div
                  key={message}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white/90 backdrop-blur-sm"
                >
                  <CheckCircle2 className="mb-2 h-5 w-5 text-yellow-300" />
                  {message}
                </div>
              ))}
            </div>
          </div>
        </motion.header>

        <section
          id="community-gallery"
          className="mt-9 scroll-mt-28 sm:mt-12"
          aria-labelledby="gallery-heading"
        >
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="gallery-heading"
                className="text-2xl font-black sm:text-3xl"
              >
                Artwork from our community
              </h2>
              <p className="mt-1 text-sm font-medium text-white/80 sm:text-base">
                Select a collection to view every piece in its slideshow.
              </p>
            </div>

            <label className="relative block w-full sm:max-w-sm">
              <span className="sr-only">Search community artwork</span>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/75"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search art or artists"
                className="w-full rounded-full border border-white/25 bg-black/20 py-3 pl-12 pr-4 font-semibold text-white outline-none backdrop-blur-md transition placeholder:text-white/65 focus:border-white focus:bg-black/30 focus:ring-4 focus:ring-white/15"
              />
            </label>
          </div>

          {galleryLoading ? (
            <div className="grid min-h-[360px] place-items-center text-center">
              <div>
                <Loader2 className="mx-auto h-11 w-11 animate-spin" />
                <p className="mt-4 font-black">Loading community artwork…</p>
              </div>
            </div>
          ) : filteredArtworks.length === 0 ? (
            <div className="grid min-h-[360px] place-items-center rounded-3xl border-2 border-dashed border-white/30 bg-black/15 px-6 text-center backdrop-blur-sm">
              <div className="max-w-xl py-14">
                <ImageIcon className="mx-auto h-12 w-12" aria-hidden="true" />
                <h3 className="mt-4 text-2xl font-black sm:text-3xl">
                  {artworks.length === 0
                    ? "The community gallery is ready for its first artwork"
                    : "No artwork matched your search"}
                </h3>
                <p className="mt-3 leading-relaxed text-white/85">
                  {artworks.length === 0
                    ? "Submit an artwork or collection below. Once it has been reviewed and approved by the Burton Pride team, it will appear here."
                    : "Try searching with another collection title, artist name, pronoun or story keyword."}
                </p>
                {artworks.length === 0 ? (
                  <button
                    type="button"
                    onClick={openSubmitDialog}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-yellow-300 px-6 py-3 font-black text-purple-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    <UploadCloud className="h-5 w-5" aria-hidden="true" />
                    Submit the first artwork
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {galleryError ? (
                <div
                  role="alert"
                  className="mb-6 rounded-2xl border border-amber-200/40 bg-black/35 px-5 py-4 text-sm text-white backdrop-blur-md"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-300" />
                    <div className="min-w-0">
                      <p className="font-black">
                        The live gallery could not be loaded.
                      </p>
                      <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-xs font-semibold leading-6 text-white/90 sm:text-sm">
                        {galleryError}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {filteredArtworks.map((artwork, index) => {
                  const images = normaliseArtworkImages(artwork);
                  const cover = images[0];

                  if (!cover) return null;

                  return (
                    <motion.article
                      key={artwork.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{
                        duration: 0.4,
                        delay: (index % 4) * 0.05,
                      }}
                      className="group"
                    >
                      <button
                        type="button"
                        onClick={() => openArtwork(artwork)}
                        className="block w-full text-left"
                        aria-label={`View ${artwork.artwork_title} by ${getPublicArtistName(artwork)}`}
                      >
                        <div className="relative aspect-square overflow-hidden rounded-2xl bg-black/20 shadow-[0_14px_36px_rgba(15,23,42,0.24)] ring-1 ring-white/20 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_20px_46px_rgba(15,23,42,0.34)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cover.url}
                            alt={cover.alt_text}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />

                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-4 pb-4 pt-16">
                            <h3 className="line-clamp-2 text-base font-black leading-tight sm:text-lg">
                              {artwork.artwork_title}
                            </h3>
                            <p className="mt-1 line-clamp-1 text-xs font-bold text-white/85 sm:text-sm">
                              {getPublicArtistName(artwork)}
                              {isPublicChoiceEnabled(artwork.show_pronouns) &&
                              artwork.pronouns
                                ? ` • ${artwork.pronouns}`
                                : ""}
                            </p>
                          </div>

                          <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-xs font-black text-white shadow-lg backdrop-blur-md">
                            <ImageIcon
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {images.length}{" "}
                            {images.length === 1 ? "piece" : "pieces"}
                          </div>

                          <div className="absolute left-3 top-3 flex flex-col gap-2">
                            {artwork.featured ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-purple-950 shadow-lg sm:text-xs">
                                <Sparkles
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                Featured
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    </motion.article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* DONATION SECTION */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-12 sm:mt-16"
          aria-labelledby="community-art-donation-heading"
        >
          <div className="relative overflow-hidden rounded-3xl border-4 border-yellow-300 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 p-5 text-center shadow-2xl shadow-yellow-400/40 sm:p-8">
            <div className="relative rounded-[28px] border border-white/25 bg-purple-950/85 px-5 py-8 shadow-2xl backdrop-blur-md sm:px-10 sm:py-12">
              <p className="mb-4 inline-flex rounded-full bg-yellow-300 px-5 py-2 text-sm font-black uppercase tracking-wide text-purple-950 shadow-xl">
                Help keep Burton Pride free
              </p>

              <h2
                id="community-art-donation-heading"
                className="mb-5 text-4xl font-black text-white drop-shadow-lg sm:text-6xl"
              >
                💖 Support Your Local Pride
              </h2>

              <p className="mx-auto mb-7 max-w-3xl text-base font-semibold leading-8 text-white/95 sm:text-xl">
                Help us keep Burton Pride free for everyone. As a grassroots
                Pride, created by the community for the community, every
                donation helps us provide local support, celebrate community
                art, share Pride resources and keep our events safe and
                welcoming. Every contribution makes a real difference.
              </p>

              <div className="mx-auto mb-8 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                  href="/DonateToUs?amount=3"
                  className="rounded-2xl border border-white/25 bg-white/15 p-5 shadow-xl backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/25"
                >
                  <p className="text-4xl font-black">£3</p>
                  <p className="mt-2 text-sm font-bold text-white">
                    Helps community support
                  </p>
                </Link>

                <Link
                  href="/DonateToUs?amount=5"
                  className="rounded-2xl border border-white/25 bg-white/15 p-5 shadow-xl backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/25"
                >
                  <p className="text-4xl font-black">£5</p>
                  <p className="mt-2 text-sm font-bold text-white">
                    Helps Pride resources
                  </p>
                </Link>

                <Link
                  href="/DonateToUs?amount=10"
                  className="rounded-2xl border border-white/25 bg-white/15 p-5 shadow-xl backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/25"
                >
                  <p className="text-4xl font-black">£10</p>
                  <p className="mt-2 text-sm font-bold text-white">
                    Helps event safety
                  </p>
                </Link>

                <Link
                  href="/DonateToUs"
                  className="rounded-2xl border border-white/25 bg-white/15 p-5 shadow-xl backdrop-blur-md transition-transform hover:scale-105 hover:bg-white/25"
                >
                  <p className="text-4xl font-black">Any</p>
                  <p className="mt-2 text-sm font-bold text-white">
                    Give what you can
                  </p>
                </Link>
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/DonateToUs"
                  className="rounded-full bg-yellow-300 px-8 py-4 text-lg font-black text-purple-950 shadow-2xl shadow-yellow-300/40 transition-transform hover:scale-105 hover:bg-white sm:px-10 sm:text-xl"
                >
                  💖 Please Consider Donating
                </Link>

                <Link
                  href="/DonateToUs?type=monthly"
                  className="rounded-full bg-white px-8 py-4 text-lg font-black text-pink-600 shadow-2xl transition-transform hover:scale-105 hover:bg-pink-50 sm:px-10 sm:text-xl"
                >
                  🌈 Donate Monthly
                </Link>
              </div>

              <p className="mt-6 text-sm font-bold text-white/85">
                Burton Pride is community-led. Every donation makes a real
                difference.
              </p>
            </div>
          </div>
        </motion.section>

        <section className="mt-12 border-t border-white/20 pt-8 text-center sm:mt-16">
          <Heart className="mx-auto h-8 w-8" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-black sm:text-3xl">
            Every creative voice matters
          </h2>
          <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-white/85">
            Upload one artwork or a collection of up to {MAX_IMAGES} pieces.
            Visitors can view the full collection as one slideshow and read the
            story behind it.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={openSubmitDialog}
              className="inline-flex items-center gap-2 rounded-full bg-yellow-300 px-6 py-3 font-black text-purple-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-white"
            >
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
              Submit your collection
            </button>

            <Link
              href="/CommunityArt/TermsAndConditions"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-white/20"
            >
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              Community Art Terms
            </Link>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {selectedArtwork && selectedImages.length > 0 ? (
          <motion.div
            className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-md sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="artwork-dialog-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) {
                setSelectedArtwork(null);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ duration: 0.22 }}
              className="relative my-6 w-full max-w-6xl overflow-hidden rounded-3xl bg-white text-slate-950 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setSelectedArtwork(null)}
                className="absolute right-4 top-4 z-30 rounded-full bg-black/65 p-3 text-white shadow-lg backdrop-blur-md transition hover:bg-fuchsia-600"
                aria-label="Close artwork"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="grid lg:grid-cols-[1.3fr_0.7fr]">
                <div className="bg-slate-950 p-3 sm:p-5">
                  <div className="relative grid min-h-[320px] place-items-center overflow-hidden rounded-2xl bg-black sm:min-h-[520px]">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={`${selectedArtwork.id}-${activeSlide}`}
                        src={selectedImages[activeSlide].url}
                        alt={selectedImages[activeSlide].alt_text}
                        initial={{ opacity: 0, scale: 0.985 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.015 }}
                        transition={{ duration: 0.22 }}
                        className="max-h-[72vh] w-full object-contain"
                      />
                    </AnimatePresence>

                    {selectedImages.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => changeSlide(-1)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/65 p-3 text-white shadow-lg backdrop-blur-md transition hover:bg-white hover:text-slate-950"
                          aria-label="Previous artwork"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                          type="button"
                          onClick={() => changeSlide(1)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/65 p-3 text-white shadow-lg backdrop-blur-md transition hover:bg-white hover:text-slate-950"
                          aria-label="Next artwork"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </button>

                        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-sm font-black text-white backdrop-blur-md">
                          <button
                            type="button"
                            onClick={() =>
                              setSlideshowPlaying((current) => !current)
                            }
                            className="rounded-full p-1 transition hover:bg-white/20"
                            aria-label={
                              slideshowPlaying
                                ? "Pause automatic slideshow"
                                : "Play automatic slideshow"
                            }
                          >
                            {slideshowPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                          <span>
                            {activeSlide + 1} / {selectedImages.length}
                          </span>
                        </div>
                      </>
                    ) : null}
                  </div>

                  {selectedImages.length > 1 ? (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {selectedImages.map((image, index) => (
                        <button
                          key={`${image.url}-${index}`}
                          type="button"
                          onClick={() => {
                            setActiveSlide(index);
                            setSlideshowPlaying(false);
                          }}
                          className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-2 transition sm:h-24 sm:w-24 ${
                            activeSlide === index
                              ? "ring-yellow-300"
                              : "ring-white/20 hover:ring-white/70"
                          }`}
                          aria-label={`View artwork ${index + 1}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-xs font-black text-white">
                            {index + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="max-h-[88vh] overflow-y-auto p-6 sm:p-9">
                  <div className="flex flex-wrap gap-2">
                    {selectedArtwork.featured ? (
                      <p className="inline-flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-purple-950">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        Featured artwork
                      </p>
                    ) : null}
                  </div>

                  <h2
                    id="artwork-dialog-title"
                    className="mt-4 text-3xl font-black leading-tight sm:text-5xl"
                  >
                    {selectedArtwork.artwork_title}
                  </h2>

                  <p className="mt-3 text-lg font-black text-fuchsia-700">
                    {getPublicArtistName(selectedArtwork)}
                    {isPublicChoiceEnabled(selectedArtwork.show_pronouns) &&
                    selectedArtwork.pronouns ? (
                      <span className="font-semibold text-slate-500">
                        {" "}
                        • {selectedArtwork.pronouns}
                      </span>
                    ) : null}
                  </p>

                  <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                    <ImageIcon className="h-4 w-4" />
                    {selectedImages.length}{" "}
                    {selectedImages.length === 1 ? "artwork" : "artworks"} in
                    this collection
                  </div>

                  {isPublicChoiceEnabled(selectedArtwork.show_story) ? (
                    <div className="mt-7 border-l-4 border-fuchsia-600 pl-5">
                      <p className="whitespace-pre-wrap leading-8 text-slate-700">
                        {selectedArtwork.story}
                      </p>
                    </div>
                  ) : null}

                  {isPublicChoiceEnabled(
                    selectedArtwork.show_image_descriptions,
                  ) ? (
                    <div className="mt-7 rounded-2xl bg-slate-100 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Description for artwork {activeSlide + 1}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">
                        {selectedImages[activeSlide].alt_text}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {submitOpen ? (
          <motion.div
            className="fixed inset-0 z-[210] overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submission-dialog-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) closeSubmitDialog();
            }}
          >
            <div className="grid min-h-full place-items-center">
              <motion.div
                ref={submitDialogRef}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.97, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 12 }}
                transition={{ duration: 0.22 }}
                className="relative my-5 w-full max-w-6xl overflow-hidden rounded-3xl bg-white text-slate-950 shadow-2xl outline-none"
              >
                <button
                  type="button"
                  onClick={closeSubmitDialog}
                  disabled={submitting}
                  className="absolute right-4 top-4 z-20 rounded-full bg-black/55 p-3 text-white shadow-lg backdrop-blur-md transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Close submission form"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>

                <div className="bg-[linear-gradient(115deg,#ef2da3_0%,#bd39e8_47%,#5d70f4_100%)] px-6 py-8 text-white sm:px-9 sm:py-10">
                  <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide backdrop-blur-sm">
                    <UploadCloud className="h-4 w-4" aria-hidden="true" />
                    Multi-art community submission
                  </p>
                  <h2
                    id="submission-dialog-title"
                    className="mt-4 pr-12 text-3xl font-black sm:text-5xl"
                  >
                    Submit your artwork collection
                  </h2>
                  <p className="mt-3 max-w-3xl leading-relaxed text-white/90 sm:text-lg">
                    Upload between 1 and {MAX_IMAGES} pieces in one submission.
                    They will appear together as a slideshow after the Burton
                    Pride team approves them.
                  </p>
                </div>

                {submitted ? (
                  <div className="p-6 sm:p-10">
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-center">
                      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                      <h3 className="mt-4 text-3xl font-black text-emerald-900">
                        Collection submitted
                      </h3>
                      <p className="mx-auto mt-3 max-w-xl leading-relaxed text-emerald-800">
                        Thank you. Your submission containing {submittedCount}{" "}
                        {submittedCount === 1 ? "artwork" : "artworks"} has been
                        sent to the Burton Pride admin portal for review. It
                        will only appear in the gallery after approval.
                      </p>
                      <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <button
                          type="button"
                          onClick={closeSubmitDialog}
                          className="rounded-full bg-emerald-700 px-6 py-3 font-black text-white transition hover:bg-emerald-600"
                        >
                          Close window
                        </button>
                        <button
                          type="button"
                          onClick={resetSubmissionForm}
                          className="rounded-full bg-white px-6 py-3 font-black text-emerald-800 ring-1 ring-emerald-300 transition hover:bg-emerald-100"
                        >
                          Submit another collection
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="p-6 sm:p-9"
                    noValidate
                  >
                    {formError ? (
                      <div
                        role="alert"
                        aria-live="assertive"
                        className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-950 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" />
                          <div className="min-w-0">
                            <h3 className="font-black">
                              We could not complete your submission
                            </h3>
                            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm font-semibold leading-6 text-red-900">
                              {formError}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-7 lg:grid-cols-[0.92fr_1.08fr]">
                      <div>
                        <div className="rounded-3xl bg-slate-100 p-5">
                          <h3 className="text-xl font-black">
                            Before you submit
                          </h3>
                          <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700">
                            <div className="flex gap-3">
                              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-700" />
                              <p>
                                Only submit artwork you created or have clear
                                permission to share.
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-700" />
                              <p>
                                Your email stays private and is only used to
                                contact you about your submission.
                              </p>
                            </div>
                            <div className="flex gap-3">
                              <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-700" />
                              <p>
                                Add up to {MAX_IMAGES} images. Each image can be
                                up to 8MB, with a combined limit of 40MB.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 flex items-end justify-between gap-3">
                            <FieldLabel required>Artwork images</FieldLabel>
                            <span className="pb-2 text-xs font-black text-slate-500">
                              {uploadImages.length}/{MAX_IMAGES} selected
                            </span>
                          </div>

                          <label className="group block cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-fuchsia-500 hover:bg-fuchsia-50">
                            <input
                              type="file"
                              multiple
                              accept={ACCEPTED_IMAGE_TYPES.join(",")}
                              className="sr-only"
                              onChange={(event) => {
                                handleImageFiles(event.target.files);
                                event.currentTarget.value = "";
                              }}
                            />
                            <div className="grid min-h-40 place-items-center p-6 text-center">
                              <div>
                                {uploadImages.length > 0 ? (
                                  <Plus className="mx-auto h-10 w-10 text-fuchsia-700 transition group-hover:scale-110" />
                                ) : (
                                  <UploadCloud className="mx-auto h-11 w-11 text-fuchsia-700 transition group-hover:-translate-y-1" />
                                )}
                                <p className="mt-3 font-black text-slate-900">
                                  {uploadImages.length > 0
                                    ? "Add more artwork"
                                    : "Choose one or more artwork images"}
                                </p>
                                <p className="mt-2 text-sm text-slate-500">
                                  JPG, PNG, WEBP or GIF • maximum 8 images
                                </p>
                              </div>
                            </div>
                          </label>

                          {uploadImages.length > 0 ? (
                            <div className="mt-4 space-y-4">
                              {uploadImages.map((item, index) => (
                                <div
                                  key={item.id}
                                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                                >
                                  <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[145px_1fr]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={item.previewUrl}
                                      alt=""
                                      className="h-full min-h-36 w-full bg-slate-100 object-cover"
                                    />
                                    <div className="min-w-0 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-xs font-black uppercase tracking-wide text-fuchsia-700">
                                            Artwork {index + 1}
                                          </p>
                                          <p className="mt-1 truncate text-sm font-black text-slate-900">
                                            {item.file.name}
                                          </p>
                                          <p className="mt-1 text-xs font-semibold text-slate-400">
                                            {formatFileSize(item.file.size)}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeUploadImage(item.id)
                                          }
                                          className="rounded-full bg-red-50 p-2 text-red-700 transition hover:bg-red-100"
                                          aria-label={`Remove ${item.file.name}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>

                                      <label className="mt-3 block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">
                                          Image description *
                                        </span>
                                        <textarea
                                          required
                                          minLength={10}
                                          maxLength={300}
                                          rows={3}
                                          value={item.altText}
                                          onChange={(event) =>
                                            updateUploadAltText(
                                              item.id,
                                              event.target.value,
                                            )
                                          }
                                          placeholder="Describe what is visible in this artwork."
                                          className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-fuchsia-600 focus:ring-4 focus:ring-fuchsia-100"
                                        />
                                        <span className="mt-1 block text-right text-[11px] font-semibold text-slate-400">
                                          {item.altText.length}/300
                                        </span>
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div>
                        <div className="grid gap-5 sm:grid-cols-2">
                          <label className="block">
                            <FieldLabel required>Your full name</FieldLabel>
                            <input
                              required
                              maxLength={100}
                              autoComplete="name"
                              value={form.artistName}
                              onChange={(event) =>
                                updateForm("artistName", event.target.value)
                              }
                              placeholder="Only visible to the Burton Pride team"
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-600 focus:ring-4 focus:ring-fuchsia-100"
                            />
                            <span className="mt-2 block text-xs font-semibold text-slate-500">
                              This is kept private and used only to manage your
                              submission.
                            </span>
                          </label>

                          <label className="block">
                            <FieldLabel required={form.showArtistName}>
                              Artist name shown publicly
                            </FieldLabel>
                            <input
                              required={form.showArtistName}
                              maxLength={100}
                              value={form.publicArtistName}
                              onChange={(event) =>
                                updateForm(
                                  "publicArtistName",
                                  event.target.value,
                                )
                              }
                              placeholder="For example: Cameron Art Studio"
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-600 focus:ring-4 focus:ring-fuchsia-100"
                            />
                            <span className="mt-2 block text-xs font-semibold text-slate-500">
                              This can be your chosen name, creative name or
                              organisation name.
                            </span>
                          </label>
                        </div>

                        <div className="mt-5 grid gap-5 sm:grid-cols-2">
                          <label className="block">
                            <FieldLabel required>Pronouns</FieldLabel>
                            <input
                              required
                              maxLength={60}
                              value={form.pronouns}
                              onChange={(event) =>
                                updateForm("pronouns", event.target.value)
                              }
                              placeholder="For example: she/her"
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-600 focus:ring-4 focus:ring-fuchsia-100"
                            />
                          </label>

                          <label className="block">
                            <FieldLabel required>Email address</FieldLabel>
                            <input
                              required
                              type="email"
                              maxLength={200}
                              autoComplete="email"
                              value={form.email}
                              onChange={(event) =>
                                updateForm("email", event.target.value)
                              }
                              placeholder="Only visible to the Burton Pride team"
                              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-600 focus:ring-4 focus:ring-fuchsia-100"
                            />
                          </label>
                        </div>

                        <label className="mt-5 block">
                          <FieldLabel required>Collection title</FieldLabel>
                          <input
                            required
                            maxLength={120}
                            value={form.artworkTitle}
                            onChange={(event) =>
                              updateForm("artworkTitle", event.target.value)
                            }
                            placeholder="Give this artwork or collection a title"
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-600 focus:ring-4 focus:ring-fuchsia-100"
                          />
                        </label>

                        <label className="mt-5 block">
                          <span className="mb-2 flex items-end justify-between gap-3 text-sm font-black text-slate-900">
                            <span>
                              Your story and what the artwork means to you
                              <span className="ml-1 text-fuchsia-700">*</span>
                            </span>
                            <span className="text-xs font-semibold text-slate-400">
                              {form.story.length}/2,000
                            </span>
                          </span>
                          <textarea
                            required
                            minLength={20}
                            maxLength={2000}
                            rows={8}
                            value={form.story}
                            onChange={(event) =>
                              updateForm("story", event.target.value)
                            }
                            placeholder="Tell visitors why you created this piece or collection, what inspired it and why you would like it shown in the Burton Pride community gallery."
                            className="w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-600 focus:ring-4 focus:ring-fuchsia-100"
                          />
                        </label>

                        <div className="mt-5 rounded-3xl border border-fuchsia-200 bg-fuchsia-50 p-5">
                          <div className="flex items-start gap-3">
                            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-fuchsia-700" />
                            <div>
                              <h3 className="text-lg font-black text-slate-950">
                                Choose what visitors can see
                              </h3>
                              <p className="mt-1 text-sm leading-relaxed text-slate-700">
                                Burton Pride needs your contact details to
                                review the submission, but you control which
                                personal details are shown publicly. Your email
                                address is never displayed.
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {[
                              {
                                key: "showArtistName" as const,
                                title: "Show my artist name",
                                description: form.showArtistName
                                  ? `Visitors will see “${form.publicArtistName.trim() || "your chosen artist name"}”.`
                                  : "Visitors will see “Anonymous artist”.",
                              },
                              {
                                key: "showPronouns" as const,
                                title: "Show my pronouns",
                                description:
                                  "Your pronouns will appear beside your artist name.",
                              },
                              {
                                key: "showStory" as const,
                                title: "Show my story",
                                description:
                                  "Visitors can read what the artwork means to you.",
                              },
                              {
                                key: "showImageDescriptions" as const,
                                title: "Show image descriptions",
                                description:
                                  "Descriptions will be visible below each artwork and still used for accessibility.",
                              },
                            ].map((choice) => (
                              <label
                                key={choice.key}
                                className="flex cursor-pointer gap-3 rounded-2xl border border-fuchsia-200 bg-white p-4 transition hover:border-fuchsia-400"
                              >
                                <input
                                  type="checkbox"
                                  checked={form[choice.key]}
                                  onChange={(event) =>
                                    updateForm(choice.key, event.target.checked)
                                  }
                                  className="mt-1 h-5 w-5 shrink-0 accent-fuchsia-700"
                                />
                                <span>
                                  <span className="block text-sm font-black text-slate-900">
                                    {choice.title}
                                  </span>
                                  <span className="mt-1 block text-xs leading-relaxed text-slate-600">
                                    {choice.description}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>

                          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-semibold leading-relaxed text-slate-600">
                            Image descriptions are always collected so Burton
                            Pride can make the gallery accessible. Choosing not
                            to show them only hides the visible description box;
                            the description may still be used as alternative
                            text for screen readers.
                          </p>
                        </div>

                        <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                          Website
                          <input
                            type="text"
                            tabIndex={-1}
                            autoComplete="off"
                            value={form.website}
                            onChange={(event) =>
                              updateForm("website", event.target.value)
                            }
                          />
                        </label>

                        <div className="mt-5 space-y-4 rounded-2xl bg-slate-100 p-5">
                          <h3 className="text-lg font-black text-slate-950">
                            Artist declaration and permission
                          </h3>

                          <label className="flex cursor-pointer gap-3">
                            <input
                              required
                              type="checkbox"
                              checked={form.rightsConfirmed}
                              onChange={(event) =>
                                updateForm(
                                  "rightsConfirmed",
                                  event.target.checked,
                                )
                              }
                              className="mt-1 h-5 w-5 shrink-0 accent-fuchsia-700"
                            />
                            <span className="text-sm leading-relaxed text-slate-700">
                              I confirm that I created every submitted artwork
                              or have clear permission from the copyright owner
                              to submit it. I understand that I keep ownership
                              and copyright of my original artwork.
                            </span>
                          </label>

                          <label className="flex cursor-pointer gap-3">
                            <input
                              required
                              type="checkbox"
                              checked={form.noAiConfirmed}
                              onChange={(event) =>
                                updateForm(
                                  "noAiConfirmed",
                                  event.target.checked,
                                )
                              }
                              className="mt-1 h-5 w-5 shrink-0 accent-fuchsia-700"
                            />
                            <span className="text-sm leading-relaxed text-slate-700">
                              I confirm that the submitted artwork was created
                              by a person and is not fully or mainly generated
                              using artificial intelligence. I understand that
                              Burton Pride may ask for reasonable evidence of my
                              creative process if concerns are raised.
                            </span>
                          </label>

                          <label className="flex cursor-pointer gap-3">
                            <input
                              required
                              type="checkbox"
                              checked={form.publicConsent}
                              onChange={(event) =>
                                updateForm(
                                  "publicConsent",
                                  event.target.checked,
                                )
                              }
                              className="mt-1 h-5 w-5 shrink-0 accent-fuchsia-700"
                            />
                            <span className="text-sm leading-relaxed text-slate-700">
                              I give Burton Pride C.I.C. limited, non-exclusive
                              and revocable permission to review and display my
                              artwork, its title and only the information I have
                              chosen to show publicly. My email address will
                              remain private.
                            </span>
                          </label>

                          <label className="flex cursor-pointer gap-3">
                            <input
                              required
                              type="checkbox"
                              checked={form.termsAccepted}
                              onChange={(event) =>
                                updateForm(
                                  "termsAccepted",
                                  event.target.checked,
                                )
                              }
                              className="mt-1 h-5 w-5 shrink-0 accent-fuchsia-700"
                            />
                            <span className="text-sm leading-relaxed text-slate-700">
                              I have read and agree to the{" "}
                              <Link
                                href="/CommunityArt/TermsAndConditions"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-black text-fuchsia-700 underline decoration-2 underline-offset-2 hover:text-fuchsia-900"
                              >
                                Burton Pride Community Art Terms and Conditions
                              </Link>
                              . I understand that I can ask Burton Pride to
                              remove my artwork in line with those terms.
                            </span>
                          </label>
                        </div>

                        <button
                          type="submit"
                          disabled={submitting}
                          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(115deg,#ef2da3_0%,#bd39e8_47%,#5d70f4_100%)] px-7 py-4 text-lg font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                        >
                          {submitting ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              Uploading {uploadImages.length}{" "}
                              {uploadImages.length === 1
                                ? "artwork"
                                : "artworks"}
                              …
                            </>
                          ) : (
                            <>
                              <UploadCloud className="h-5 w-5" />
                              Submit {uploadImages.length || "your"}{" "}
                              {uploadImages.length === 1
                                ? "artwork"
                                : "artworks"}{" "}
                              for review
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
