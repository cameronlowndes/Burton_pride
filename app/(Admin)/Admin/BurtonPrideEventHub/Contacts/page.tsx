"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  CircleMinus,
  Download,
  Edit,
  Eye,
  Globe,
  ImagePlus,
  Lock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Search,
  Send,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { useBurtonPrideEvent } from "../../components/event-hub/BurtonPrideEventProvider";

type ContactRating = "good" | "ok" | "do_not_invite";

type Contact = {
  id: string;
  event_id?: string | null;
  event_year?: number | null;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  service_type: string | null;
  working_rating?: ContactRating | null;
  selling: string | null;
  selling_image_url: string | null;
  selling_image_path?: string | null;
  notes: string | null;
  is_active: boolean;
  sent_to_checklist?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  details?: string;
  code?: string;
  contacts?: Contact[];
  contact?: Contact;
  url?: string;
  path?: string;
};

type NoticeMessage = {
  type: "success" | "error";
  title: string;
  message: string;
  details?: string;
  status?: number;
  endpoint?: string;
};

type DetailedError = Error & {
  status?: number;
  endpoint?: string;
  action?: string;
  details?: string;
};

type FormState = {
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  service_type: string;
  working_rating: ContactRating | "";
  selling: string;
  selling_image_url: string;
  selling_image_path: string;
  notes: string;
  is_active: boolean;
  sent_to_checklist: boolean;
};

const CONTACTS_API = "/api/admin/burton-pride-event-hub/contacts";
const IMAGE_UPLOAD_API = "/api/admin/burton-pride-event-hub/contacts/event-hub-selling-images";
const CHECKLIST_API = "/api/admin/burton-pride-event-hub/checklist";

const emptyForm: FormState = {
  business_name: "",
  contact_name: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  service_type: "",
  working_rating: "",
  selling: "",
  selling_image_url: "",
  selling_image_path: "",
  notes: "",
  is_active: true,
  sent_to_checklist: false,
};

const serviceTypes = [
  "Supplier",
  "Vendor",
  "Sponsor",
  "Venue",
  "Contractor",
  "Entertainer",
  "Charity",
  "Community Partner",
  "Food Vendor",
  "Security",
  "Medical / First Aid",
  "Toilets",
  "Waste / Bins",
  "Marketing",
  "Other",
];

const activeFilters = [
  { value: "", label: "All contacts" },
  { value: "active", label: "Active only" },
  { value: "inactive", label: "Inactive only" },
];

const ratingOptions: Array<{
  value: ContactRating | "";
  label: string;
  description: string;
}> = [
  {
    value: "",
    label: "Not rated yet",
    description: "No working relationship rating has been recorded.",
  },
  {
    value: "good",
    label: "Good to work with",
    description: "Reliable, professional, and suitable to invite again.",
  },
  {
    value: "ok",
    label: "Okay",
    description: "Generally acceptable, but review notes before inviting again.",
  },
  {
    value: "do_not_invite",
    label: "Do not invite",
    description: "Do not invite or send this contact to a future event checklist.",
  },
];

const ratingFilters = [
  { value: "", label: "All ratings" },
  { value: "good", label: "Good to work with" },
  { value: "ok", label: "Okay" },
  { value: "do_not_invite", label: "Do not invite" },
  { value: "unrated", label: "Not rated yet" },
];

const dataFilters = [
  { value: "", label: "All data" },
  { value: "missing_email", label: "Missing email" },
  { value: "has_email", label: "Has email" },
  { value: "missing_selling", label: "Missing selling info" },
  { value: "has_selling", label: "Has selling info" },
  { value: "missing_image", label: "Missing image" },
  { value: "has_image", label: "Has image" },
  { value: "not_sent_to_checklist", label: "Not sent to checklist" },
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isFoodVendor(contact: Pick<Contact, "service_type"> | Pick<FormState, "service_type">) {
  return clean(contact.service_type).toLowerCase().includes("food");
}

function isSeller(contact: Pick<Contact, "service_type"> | Pick<FormState, "service_type">) {
  const type = clean(contact.service_type).toLowerCase();
  return type.includes("vendor") || type.includes("supplier") || type.includes("sponsor") || type.includes("charity");
}

function normaliseWebsite(value: string) {
  const text = clean(value);
  if (!text) return "";
  if (text.startsWith("http://") || text.startsWith("https://")) return text;
  return `https://${text}`;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function getRatingLabel(value?: ContactRating | null) {
  return (
    ratingOptions.find((option) => option.value === (value || ""))?.label ||
    "Not rated yet"
  );
}

function isDoNotInvite(contact: Pick<Contact, "working_rating">) {
  return contact.working_rating === "do_not_invite";
}

export default function EventHubContactsPage() {
  const {
    currentEvent,
    eventId,
    eventYear,
    isEventLocked,
    loading: eventLoading,
    error: eventError,
    refreshEvent,
  } = useBurtonPrideEvent();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [dataFilter, setDataFilter] = useState("");
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [imagePreview, setImagePreview] = useState<{
    url: string;
    title: string;
    missing?: boolean;
    message?: string;
  } | null>(null);

  const [imagePreviewFailed, setImagePreviewFailed] = useState(false);
  const [formLocalImageUrl, setFormLocalImageUrl] = useState("");
  const [localImageUrls, setLocalImageUrls] = useState<Record<string, string>>({});

  const canEdit = !eventLoading && !isEventLocked;

  async function readJson(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return text
        ? JSON.parse(text)
        : { ok: false, error: "Server returned an empty response." };
    } catch {
      return {
        ok: false,
        error: "Server returned invalid JSON instead of the expected API response.",
        details: text
          ? `Raw server response: ${text.slice(0, 500)}`
          : "The server response was empty.",
      };
    }
  }

  function createApiError({
    action,
    endpoint,
    res,
    data,
    fallbackMessage,
  }: {
    action: string;
    endpoint: string;
    res: Response;
    data: ApiResponse;
    fallbackMessage: string;
  }) {
    const error = new Error(data.error || fallbackMessage) as DetailedError;

    error.status = res.status;
    error.endpoint = endpoint;
    error.action = action;
    error.details = data.details || data.code;

    return error;
  }

  function createLocalError(action: string, message: string, details?: string) {
    const error = new Error(message) as DetailedError;

    error.action = action;
    error.details = details;

    return error;
  }

  function getHelpfulErrorDetails(error: DetailedError) {
    const status = error.status;
    const message = error.message.toLowerCase();
    const endpoint = error.endpoint || "Unknown endpoint";

    const baseDetails = [
      `Action: ${error.action || "Unknown action"}`,
      `Endpoint: ${endpoint}`,
      status ? `Status code: ${status}` : "Status code: Not available",
    ];

    if (error.details) baseDetails.push(`Server details: ${error.details}`);

    if (status === 401) {
      baseDetails.push(
        "",
        "What this means:",
        "Your admin login session was not accepted by this API route.",
        "",
        "What to check:",
        "1. Sign out and sign back into the admin portal.",
        '2. Make sure fetch requests include credentials: "include".',
        "3. Make sure the API route checks your Burton admin cookies or Supabase session.",
      );
    } else if (status === 403) {
      baseDetails.push(
        "",
        "What this means:",
        "You are logged in, but this admin account does not have permission for this action.",
        "",
        "What to check:",
        "1. Check the admin_users row for this user.",
        "2. Make sure is_active is true.",
        "3. Make sure the role or permissions allow this action.",
      );
    } else if (status === 404) {
      baseDetails.push(
        "",
        "What this means:",
        "Next.js could not find the API route.",
        "",
        "What to check:",
        "1. Make sure the route file is called route.ts.",
        "2. Check the folder path exactly matches the endpoint.",
        "3. Restart the dev server after adding the new route.",
      );
    } else if (status === 400) {
      baseDetails.push(
        "",
        "What this means:",
        "The request was sent, but the API rejected the data.",
        "",
        "What to check:",
        "1. Make sure the required fields are filled in.",
        "2. Check the event_id is being saved correctly.",
        "3. For image uploads, only use JPG, PNG, WEBP, or GIF under 5MB.",
      );
    } else if (status === 413 || message.includes("smaller than 5mb")) {
      baseDetails.push(
        "",
        "What this means:",
        "The uploaded image is too large.",
        "",
        "What to do:",
        "Compress the image or choose a smaller image under 5MB.",
      );
    } else if (status && status >= 500) {
      baseDetails.push(
        "",
        "What this means:",
        "The server found the route, but something failed inside the API.",
        "",
        "What to check:",
        "1. Check the terminal/server logs.",
        "2. Check NEXT_PUBLIC_SUPABASE_URL is set.",
        "3. Check SUPABASE_SERVICE_ROLE_KEY is set.",
        "4. Check the Supabase table columns match this page.",
        "5. Check the storage bucket exists if uploading images.",
      );
    } else if (message.includes("image file")) {
      baseDetails.push(
        "",
        "What this means:",
        "The selected file is not recognised as an image.",
        "",
        "What to do:",
        "Choose a JPG, PNG, WEBP, or GIF image.",
      );
    } else {
      baseDetails.push(
        "",
        "What to check:",
        "1. Refresh the page and try again.",
        "2. Check your admin login session.",
        "3. Check the browser Network tab for the failed request.",
        "4. Check the server terminal logs for more information.",
      );
    }

    return baseDetails.join("\n");
  }

  function buildErrorNotice(
    error: unknown,
    title: string,
    fallbackMessage: string,
  ): NoticeMessage {
    if (error instanceof Error) {
      const detailedError = error as DetailedError;

      return {
        type: "error",
        title,
        message: detailedError.message || fallbackMessage,
        details: getHelpfulErrorDetails(detailedError),
        status: detailedError.status,
        endpoint: detailedError.endpoint,
      };
    }

    return {
      type: "error",
      title,
      message: fallbackMessage,
      details:
        "No extra error information was available. Check the browser Network tab and the server terminal logs.",
    };
  }

  function requireEditableEvent() {
    if (eventLoading) {
      throw createLocalError(
        "Check active event",
        "The active Burton Pride event is still loading.",
        "Wait for the active event bar to finish loading, then try again.",
      );
    }

    if (isEventLocked) {
      const eventLabel = currentEvent
        ? `${currentEvent.event_name} ${currentEvent.event_year}`
        : "The current event";

      throw createLocalError(
        "Check event lock",
        `${eventLabel} is locked.`,
        "Unlock the event in Event Management before adding, editing, uploading, deleting, or sending contacts to the checklist.",
      );
    }
  }

  function eventQuery() {
    const params = new URLSearchParams();
    if (eventId) params.set("event_id", eventId);
    if (eventYear) params.set("event_year", String(eventYear));
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  async function loadContacts() {
    try {
      setLoading(true);
      setNotice(null);

      if (eventLoading) return;

      const endpoint = `${CONTACTS_API}${eventQuery()}`;
      const res = await fetch(endpoint, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw createApiError({
          action: "Load saved contacts",
          endpoint,
          res,
          data,
          fallbackMessage: "Failed to load contacts.",
        });
      }

      const loadedContacts = data.contacts || [];
      setContacts(loadedContacts);
    } catch (error) {
      setNotice(
        buildErrorNotice(
          error,
          "Could not load contacts",
          "Failed to load contacts.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!eventLoading) loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventLoading, eventId, eventYear]);

  const stats = useMemo(() => {
    const total = contacts.length;
    const active = contacts.filter((contact) => contact.is_active).length;
    const foodVendors = contacts.filter((contact) => isFoodVendor(contact)).length;
    const missingEmail = contacts.filter((contact) => !clean(contact.email)).length;
    const missingSelling = contacts.filter((contact) => isSeller(contact) && !clean(contact.selling)).length;
    const missingImage = contacts.filter((contact) => isSeller(contact) && !getContactImageUrl(contact)).length;
    const notSentToChecklist = contacts.filter((contact) => !contact.sent_to_checklist).length;
    const goodToWorkWith = contacts.filter(
      (contact) => contact.working_rating === "good",
    ).length;
    const okayToWorkWith = contacts.filter(
      (contact) => contact.working_rating === "ok",
    ).length;
    const doNotInvite = contacts.filter(
      (contact) => contact.working_rating === "do_not_invite",
    ).length;

    return {
      total,
      active,
      foodVendors,
      missingEmail,
      missingSelling,
      missingImage,
      notSentToChecklist,
      goodToWorkWith,
      okayToWorkWith,
      doNotInvite,
    };
  }, [contacts, localImageUrls, editingId, form.selling_image_url, formLocalImageUrl]);

  const duplicateWarning = useMemo(() => {
    const name = clean(form.business_name).toLowerCase();
    const email = clean(form.email).toLowerCase();

    if (!name && !email) return "";

    const duplicate = contacts.find((contact) => {
      if (editingId && contact.id === editingId) return false;
      const sameName = name && clean(contact.business_name).toLowerCase() === name;
      const sameEmail = email && clean(contact.email).toLowerCase() === email;
      return sameName || sameEmail;
    });

    if (!duplicate) return "";
    return `Possible duplicate: ${duplicate.business_name}${duplicate.email ? ` (${duplicate.email})` : ""}`;
  }, [contacts, editingId, form.business_name, form.email]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const selectedType = serviceTypeFilter.trim().toLowerCase();

    return contacts.filter((contact) => {
      const serviceType = clean(contact.service_type).toLowerCase();
      const imageUrl = getContactImageUrl(contact);

      const matchesServiceType = !selectedType || serviceType === selectedType;

      const matchesActive =
        !activeFilter ||
        (activeFilter === "active" && contact.is_active) ||
        (activeFilter === "inactive" && !contact.is_active);

      const matchesRating =
        !ratingFilter ||
        (ratingFilter === "unrated" && !contact.working_rating) ||
        contact.working_rating === ratingFilter;

      const matchesData =
        !dataFilter ||
        (dataFilter === "missing_email" && !clean(contact.email)) ||
        (dataFilter === "has_email" && Boolean(clean(contact.email))) ||
        (dataFilter === "missing_selling" && !clean(contact.selling)) ||
        (dataFilter === "has_selling" && Boolean(clean(contact.selling))) ||
        (dataFilter === "missing_image" && !imageUrl) ||
        (dataFilter === "has_image" && Boolean(imageUrl)) ||
        (dataFilter === "not_sent_to_checklist" && !contact.sent_to_checklist);

      const matchesSearch =
        !q ||
        contact.business_name.toLowerCase().includes(q) ||
        clean(contact.contact_name).toLowerCase().includes(q) ||
        clean(contact.email).toLowerCase().includes(q) ||
        clean(contact.phone).toLowerCase().includes(q) ||
        clean(contact.website).toLowerCase().includes(q) ||
        clean(contact.address).toLowerCase().includes(q) ||
        serviceType.includes(q) ||
        getRatingLabel(contact.working_rating).toLowerCase().includes(q) ||
        clean(contact.selling).toLowerCase().includes(q) ||
        clean(contact.notes).toLowerCase().includes(q);

      return (
        matchesServiceType &&
        matchesActive &&
        matchesRating &&
        matchesData &&
        matchesSearch
      );
    });
  }, [
    contacts,
    search,
    serviceTypeFilter,
    activeFilter,
    ratingFilter,
    dataFilter,
    localImageUrls,
  ]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFormLocalImageUrl("");
  }

  function openImagePreview(url: string, title: string) {
    setImagePreviewFailed(false);
    setImagePreview({ url: url.trim(), title });
  }

  function openMissingImagePreview(title: string) {
    setImagePreviewFailed(false);
    setImagePreview({
      url: "",
      title,
      missing: true,
      message:
        "No image has been saved to this contact yet. Click Edit, choose an image, and the preview button will work straight away while the upload saves in the background.",
    });
  }

  function rememberLocalContactImage(contactId: string, imageUrl: string) {
    const cleanUrl = imageUrl.trim();
    if (!contactId || !cleanUrl) return;

    setLocalImageUrls((prev) => ({ ...prev, [contactId]: cleanUrl }));
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId
          ? { ...contact, selling_image_url: contact.selling_image_url || cleanUrl }
          : contact,
      ),
    );
  }

  function getContactImageUrl(contact: Contact) {
    const savedImageUrl = clean(contact.selling_image_url);
    const localImageUrl = clean(localImageUrls[contact.id]);
    const editingFormImageUrl = editingId === contact.id ? clean(form.selling_image_url) : "";
    const editingLocalImageUrl = editingId === contact.id ? clean(formLocalImageUrl) : "";

    return editingLocalImageUrl || localImageUrl || savedImageUrl || editingFormImageUrl;
  }

  function handleViewContactImage(contact: Contact) {
    const imageUrl = getContactImageUrl(contact);

    if (imageUrl) {
      openImagePreview(imageUrl, contact.business_name);
      return;
    }

    if (uploadingImage && editingId === contact.id) {
      setNotice({
        type: "error",
        title: "Image is still uploading",
        message: `Please wait for the image upload to finish for ${contact.business_name}.`,
        details:
          "Once the upload has finished, the View image button will open it automatically.",
      });
      return;
    }

    openMissingImagePreview(contact.business_name);
  }

  function buildEmail(contact: Contact) {
    const contactName = clean(contact.contact_name);
    const businessName = clean(contact.business_name);
    const serviceType = clean(contact.service_type);
    const selling = clean(contact.selling);

    const eventName = currentEvent
      ? `${currentEvent.event_name} ${currentEvent.event_year}`
      : "Burton Pride";

    const eventDate = currentEvent?.event_date || "the event date";
    const eventTimes = currentEvent
      ? `${currentEvent.event_start_time || "12:00"} to ${currentEvent.event_end_time || "18:00"}`
      : "12:00 to 18:00";
    const venue = currentEvent?.venue_name || "our event venue";
    const address = currentEvent?.venue_address || "";

    const subject = `Invitation to ${eventName} - ${businessName}`;

    const body = [
      `Hello ${contactName || businessName},`,
      "",
      "I hope you are well.",
      "",
      `We are getting in touch from Burton Pride C.I.C. to invite ${businessName} to be part of ${eventName}.`,
      "",
      `The event is currently planned for ${eventDate}, running from ${eventTimes} at ${venue}${address ? `, ${address}` : ""}.`,
      "",
      serviceType
        ? `We currently have you listed in our Event Hub as: ${serviceType}.`
        : "We currently have you saved as a contact in our Event Hub.",
      selling ? `We also have you noted as selling/providing: ${selling}.` : "",
      "",
      "We would love to welcome you as part of our community Pride event.",
      "",
      "Please could you confirm whether you would like to take part, and whether your contact details and setup requirements are still correct.",
      "",
      "If you have any access needs, setup notes, or questions, please include them in your reply so our committee team can plan everything properly.",
      "",
      "Kind regards,",
      "Burton Pride C.I.C.",
    ]
      .filter(Boolean)
      .join("\n");

    return { subject, body };
  }

  function openEmailAppForContact(contact: Contact) {
    if (isDoNotInvite(contact)) {
      setNotice({
        type: "error",
        title: "Contact marked Do not invite",
        message: `${contact.business_name} is marked as Do not invite.`,
        details:
          "Review the contact notes and change the working rating before preparing a new event invitation.",
      });
      return;
    }

    const email = clean(contact.email);

    if (!email) {
      setNotice({
        type: "error",
        title: "No email address",
        message: `${contact.business_name} does not have an email address saved yet.`,
        details:
          "Add an email address to this contact first, then the Email button will open the Burton Pride email sending app.",
      });
      return;
    }

    const { subject, body } = buildEmail(contact);
    const params = new URLSearchParams({
      to: email,
      subject,
      body,
      contactId: contact.id,
      businessName: contact.business_name,
      eventId: eventId || "",
      eventYear: eventYear ? String(eventYear) : "",
    });

    window.location.href = `/Admin/Email/Sending?${params.toString()}`;
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id);

    setForm({
      business_name: contact.business_name || "",
      contact_name: contact.contact_name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      website: contact.website || "",
      address: contact.address || "",
      service_type: contact.service_type || "",
      working_rating: contact.working_rating || "",
      selling: contact.selling || "",
      selling_image_url: contact.selling_image_url || "",
      selling_image_path: contact.selling_image_path || "",
      notes: contact.notes || "",
      is_active: Boolean(contact.is_active),
      sent_to_checklist: Boolean(contact.sent_to_checklist),
    });

    setFormLocalImageUrl(localImageUrls[contact.id] || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refreshContactsKeepingImage(contactId: string, imageUrl: string) {
    await loadContacts();
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId && !contact.selling_image_url
          ? { ...contact, selling_image_url: imageUrl }
          : contact,
      ),
    );
  }

  async function saveImageUrlToContact(contactId: string, imageUrl: string, imagePath?: string) {
    const cleanImageUrl = imageUrl.trim();
    if (!contactId || !cleanImageUrl) return;

    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId
          ? {
              ...contact,
              selling_image_url: cleanImageUrl,
              selling_image_path: imagePath || contact.selling_image_path,
            }
          : contact,
      ),
    );

    const updatedForm = {
      ...form,
      selling_image_url: cleanImageUrl,
      selling_image_path: imagePath || form.selling_image_path,
    };

    const res = await fetch(CONTACTS_API, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: contactId,
        event_id: eventId || null,
        event_year: eventYear || null,
        ...updatedForm,
      }),
      credentials: "include",
    });

    const data = await readJson(res);

    if (!res.ok || !data.ok) {
      throw createApiError({
        action: "Save uploaded image URL to contact",
        endpoint: CONTACTS_API,
        res,
        data,
        fallbackMessage:
          "The image uploaded, but the image URL could not be saved to the contact.",
      });
    }

    await refreshContactsKeepingImage(contactId, cleanImageUrl);
  }

  async function uploadSellingImage(file: File) {
    try {
      requireEditableEvent();
      setUploadingImage(true);
      setNotice(null);

      if (!file.type.startsWith("image/")) {
        throw createLocalError(
          "Validate selected image",
          "Please upload an image file only.",
          "Choose a JPG, PNG, WEBP, or GIF image. PDF, Word documents, and other files cannot be used here.",
        );
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw createLocalError(
          "Validate selected image size",
          "Image must be smaller than 5MB.",
          `Selected file size: ${(file.size / 1024 / 1024).toFixed(2)}MB. Please compress the image or choose a smaller one.`,
        );
      }

      const localPreviewUrl = URL.createObjectURL(file);
      setFormLocalImageUrl(localPreviewUrl);
      if (editingId) rememberLocalContactImage(editingId, localPreviewUrl);

      const formData = new FormData();
      formData.append("file", file);
      if (eventId) formData.append("event_id", eventId);
      if (eventYear) formData.append("event_year", String(eventYear));

      const res = await fetch(IMAGE_UPLOAD_API, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok || !data.url) {
        throw createApiError({
          action: "Upload selling image",
          endpoint: IMAGE_UPLOAD_API,
          res,
          data,
          fallbackMessage: "Failed to upload image.",
        });
      }

      const uploadedImageUrl = data.url.trim();
      const uploadedImagePath = clean(data.path);

      setForm((prev) => ({
        ...prev,
        selling_image_url: uploadedImageUrl,
        selling_image_path: uploadedImagePath || prev.selling_image_path,
      }));
      setFormLocalImageUrl(uploadedImageUrl);

      if (editingId && uploadedImageUrl) {
        await saveImageUrlToContact(editingId, uploadedImageUrl, uploadedImagePath);
        setNotice({
          type: "success",
          title: "Image uploaded and saved",
          message:
            "The image has been uploaded and attached to this contact. The View image button will work now.",
        });
        return;
      }

      setNotice({
        type: "success",
        title: "Image uploaded",
        message:
          "Selling image uploaded successfully. Click Add contact to save it to the new contact.",
      });
    } catch (error) {
      setNotice(
        buildErrorNotice(
          error,
          "Could not save image to contact",
          "The local preview button will still work for this selected image, but the Supabase upload or database save failed. Check the server error, then try again.",
        ),
      );
    } finally {
      setUploadingImage(false);
    }
  }

  function buildContactPayload() {
    return {
      id: editingId || undefined,
      event_id: eventId || null,
      event_year: eventYear || null,
      business_name: clean(form.business_name),
      contact_name: clean(form.contact_name) || null,
      email: clean(form.email) || null,
      phone: clean(form.phone) || null,
      website: normaliseWebsite(form.website) || null,
      address: clean(form.address) || null,
      service_type: clean(form.service_type) || null,
      working_rating: form.working_rating || null,
      selling: clean(form.selling) || null,
      selling_image_url: clean(form.selling_image_url) || null,
      selling_image_path: clean(form.selling_image_path) || null,
      notes: clean(form.notes) || null,
      is_active: Boolean(form.is_active),
      sent_to_checklist: Boolean(form.sent_to_checklist),
    };
  }

  async function saveContact() {
    try {
      requireEditableEvent();
      setSaving(true);
      setNotice(null);

      if (!clean(form.business_name)) {
        throw createLocalError(
          "Validate contact form",
          "Please enter the business name.",
          "The business name is required before this contact can be saved.",
        );
      }

      if (clean(form.email) && !clean(form.email).includes("@")) {
        throw createLocalError(
          "Validate contact email",
          "Please enter a valid email address.",
          "The email address should include @, for example info@example.com.",
        );
      }

      const payload = buildContactPayload();
      const res = await fetch(CONTACTS_API, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw createApiError({
          action: editingId ? "Update business contact" : "Add business contact",
          endpoint: CONTACTS_API,
          res,
          data,
          fallbackMessage: "Failed to save contact.",
        });
      }

      await loadContacts();

      setNotice({
        type: "success",
        title: editingId ? "Contact updated" : "Contact added",
        message: editingId
          ? "Business contact updated successfully."
          : "Business contact added successfully.",
      });

      resetForm();
    } catch (error) {
      setNotice(
        buildErrorNotice(error, "Could not save contact", "Failed to save contact."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;

    try {
      requireEditableEvent();
      setSaving(true);
      setNotice(null);

      const res = await fetch(CONTACTS_API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteId, event_id: eventId || null, event_year: eventYear || null }),
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw createApiError({
          action: "Delete business contact",
          endpoint: CONTACTS_API,
          res,
          data,
          fallbackMessage: "Failed to delete contact.",
        });
      }

      setNotice({
        type: "success",
        title: "Contact deleted",
        message: "Business contact deleted successfully.",
      });

      if (editingId === deleteId) resetForm();
      setDeleteId(null);
      await loadContacts();
    } catch (error) {
      setNotice(
        buildErrorNotice(error, "Could not delete contact", "Failed to delete contact."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendToChecklist(contact: Contact) {
    try {
      requireEditableEvent();

      if (isDoNotInvite(contact)) {
        throw createLocalError(
          "Send contact to checklist",
          `${contact.business_name} is marked as Do not invite.`,
          "Change the working rating before adding this contact to an event checklist.",
        );
      }
      setActionId(contact.id);
      setNotice(null);

      const checklistPayload = {
        event_id: eventId || null,
        event_year: eventYear || null,
        organisation_name: contact.business_name,
        contact_name: contact.contact_name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        organisation_type: contact.service_type || "Vendor",
        pitch_number: "",
        arrival_time: currentEvent?.setup_start_time || "",
        checklist_sent: false,
        checklist_confirmed: false,
        notes: [
          contact.selling ? `Selling/providing: ${contact.selling}` : "",
          contact.address ? `Address: ${contact.address}` : "",
          contact.website ? `Website: ${contact.website}` : "",
          contact.notes || "",
        ]
          .filter(Boolean)
          .join("\n"),
        is_active: contact.is_active,
                      selling: contact.selling || "",
        selling_image_url: contact.selling_image_url || "",
      };

      const res = await fetch(CHECKLIST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checklistPayload),
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw createApiError({
          action: "Send contact to checklist",
          endpoint: CHECKLIST_API,
          res,
          data,
          fallbackMessage: "Failed to send this contact to the checklist.",
        });
      }

      const updateRes = await fetch(CONTACTS_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: contact.id,
          event_id: eventId,
          event_year: eventYear,
          sent_to_checklist: true,
        }),
        credentials: "include",
      });

      const updateData = await readJson(updateRes);
      if (!updateRes.ok || !updateData.ok) {
        throw createApiError({
          action: "Mark contact as sent to checklist",
          endpoint: CONTACTS_API,
          res: updateRes,
          data: updateData,
          fallbackMessage:
            "The contact was sent to the checklist, but it could not be marked as sent.",
        });
      }

      setNotice({
        type: "success",
        title: "Sent to checklist",
        message: `${contact.business_name} has been sent to the stallholders and charities checklist.`,
      });

      await loadContacts();
    } catch (error) {
      setNotice(
        buildErrorNotice(
          error,
          "Could not send to checklist",
          "Failed to send contact to checklist.",
        ),
      );
    } finally {
      setActionId(null);
    }
  }

  function exportContacts() {
    const headers = [
      "business_name",
      "contact_name",
      "email",
      "phone",
      "website",
      "address",
      "service_type",
      "working_rating",
      "selling",
      "selling_image_url",
      "is_active",
      "sent_to_checklist",
      "notes",
    ];

    const rows = filteredContacts.map((contact) => [
      contact.business_name,
      contact.contact_name || "",
      contact.email || "",
      contact.phone || "",
      contact.website || "",
      contact.address || "",
      contact.service_type || "",
      getRatingLabel(contact.working_rating),
      contact.selling || "",
      contact.selling_image_url || "",
      contact.is_active ? "yes" : "no",
      contact.sent_to_checklist ? "yes" : "no",
      contact.notes || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `burton-pride-contacts-${eventYear || "event"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.22),_transparent_32%),linear-gradient(180deg,#12091f_0%,#24113a_48%,#111827_100%)] text-white">
      <div className="w-full px-3 py-6 sm:px-4 lg:px-6 xl:px-8">
        <div className="mb-6 rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-pink-100">
                <Building2 className="h-4 w-4" />
                Event Hub Contacts
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight">
                Business Contacts
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
                Store suppliers, vendors, sponsors, venues, entertainers,
                charities, contractors, and community partners for the active
                Burton Pride event.
              </p>

              {currentEvent && (
                <p className="mt-2 text-xs font-bold text-pink-100/80">
                  Managing: {currentEvent.event_name} {currentEvent.event_year}
                  {currentEvent.event_date ? ` · ${currentEvent.event_date}` : ""}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={refreshEvent}
                disabled={eventLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-5 py-3 text-sm font-bold text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${eventLoading ? "animate-spin" : ""}`} />
                Event
              </button>

              <button
                type="button"
                onClick={exportContacts}
                disabled={filteredContacts.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Export
              </button>

              <button
                type="button"
                onClick={loadContacts}
                disabled={loading || eventLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {(eventError || !currentEvent || isEventLocked) && (
          <div
            className={`mb-6 rounded-3xl border p-4 text-sm font-semibold shadow-xl ${
              isEventLocked
                ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                : "border-sky-400/25 bg-sky-500/10 text-sky-100"
            }`}
          >
            <div className="flex items-start gap-3">
              {isEventLocked ? <Lock className="mt-0.5 h-5 w-5" /> : <AlertTriangle className="mt-0.5 h-5 w-5" />}
              <div>
                <p className="font-black">
                  {isEventLocked
                    ? "This event is locked"
                    : "No active event is selected"}
                </p>
                <p className="mt-1 text-white/75">
                  {isEventLocked
                    ? "Contacts can be viewed, but adding, editing, deleting, uploading, and sending to the checklist are disabled until the event is unlocked."
                    : "You can still manage your master contact list. These contacts will not be linked to a specific Burton Pride event until an active event is selected in Event Management."}
                </p>
                {eventError && <p className="mt-2 text-xs text-white/70">{eventError}</p>}
              </div>
            </div>
          </div>
        )}

        {notice && (
          <div
            className={`mb-6 rounded-2xl border p-4 text-sm shadow-xl ${
              notice.type === "success"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                : "border-red-400/30 bg-red-500/10 text-red-100"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-extrabold">{notice.title}</p>
                <p className="mt-1 font-semibold">{notice.message}</p>
              </div>

              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded-full border border-white/10 bg-white/10 p-1.5 text-white transition hover:bg-white/20"
                aria-label="Close message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {notice.details && (
              <div className="mt-4 whitespace-pre-line rounded-2xl border border-white/10 bg-black/20 p-4 text-xs font-medium leading-relaxed text-white/85">
                {notice.details}
              </div>
            )}

            {(notice.status || notice.endpoint) && (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wide text-white/70">
                {notice.status && (
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                    Status {notice.status}
                  </span>
                )}

                {notice.endpoint && (
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 normal-case">
                    {notice.endpoint}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total contacts" value={stats.total} />
          <StatCard label="Active" value={stats.active} good />
          <StatCard label="Food vendors" value={stats.foodVendors} />
          <StatCard label="Good to work with" value={stats.goodToWorkWith} good />
          <StatCard label="Okay" value={stats.okayToWorkWith} />
          <StatCard label="Do not invite" value={stats.doNotInvite} danger={stats.doNotInvite > 0} />
          <StatCard label="Missing email" value={stats.missingEmail} warning={stats.missingEmail > 0} />
          <StatCard label="Missing selling info" value={stats.missingSelling} warning={stats.missingSelling > 0} />
          <StatCard label="Missing image" value={stats.missingImage} warning={stats.missingImage > 0} />
          <StatCard label="Not sent to checklist" value={stats.notSentToChecklist} warning={stats.notSentToChecklist > 0} />
        </div>

        <div className="grid w-full gap-6 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-4 text-xl font-bold">
              {editingId ? "Edit business contact" : "Add business contact"}
            </h2>

            <div className="grid gap-4">
              <Input label="Business name" value={form.business_name} onChange={(value) => updateForm("business_name", value)} required />
              {duplicateWarning && (
                <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs font-bold text-amber-100">
                  {duplicateWarning}
                </div>
              )}
              <Input label="Contact person" value={form.contact_name} onChange={(value) => updateForm("contact_name", value)} />
              <Input label="Email address" value={form.email} onChange={(value) => updateForm("email", value)} />
              <Input label="Phone number" value={form.phone} onChange={(value) => updateForm("phone", value)} />
              <Input label="Website" value={form.website} onChange={(value) => updateForm("website", value)} />
              <Input label="Address" value={form.address} onChange={(value) => updateForm("address", value)} />

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/75">Service type</label>
                <select
                  value={form.service_type}
                  onChange={(e) => updateForm("service_type", e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                >
                  <option value="" className="bg-[#1f1030]">Select service type</option>
                  {serviceTypes.map((type) => (
                    <option key={type} value={type} className="bg-[#1f1030]">
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="mb-2 block text-sm font-semibold text-white/75">
                  Working relationship rating
                </label>
                <select
                  value={form.working_rating}
                  onChange={(e) =>
                    updateForm(
                      "working_rating",
                      e.target.value as ContactRating | "",
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                >
                  {ratingOptions.map((option) => (
                    <option
                      key={option.value || "unrated"}
                      value={option.value}
                      className="bg-[#1f1030]"
                    >
                      {option.label}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs leading-5 text-white/50">
                  {
                    ratingOptions.find(
                      (option) => option.value === form.working_rating,
                    )?.description
                  }
                </p>

                {form.working_rating === "do_not_invite" && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-xs font-semibold leading-5 text-red-100">
                    <Ban className="mt-0.5 h-4 w-4 shrink-0" />
                    Invitation emails and checklist actions will be blocked until
                    this rating is changed.
                  </div>
                )}
              </div>

              <textarea
                value={form.selling}
                onChange={(e) => updateForm("selling", e.target.value)}
                placeholder="What are they selling? Example: cakes, burgers, jewellery, pride items..."
                rows={3}
                className="resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                  <ImagePlus className="h-4 w-4" />
                  Selling image
                </div>

                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage || !canEdit}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadSellingImage(file);
                  }}
                  className="w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-black disabled:opacity-60"
                />

                {uploadingImage && (
                  <p className="mt-3 text-xs font-semibold text-pink-100">Uploading image...</p>
                )}

                {(formLocalImageUrl || form.selling_image_url) && (
                  <div className="mt-4">
                    <img
                      src={formLocalImageUrl || form.selling_image_url}
                      alt="Selling preview"
                      className="max-h-48 w-full rounded-2xl object-cover"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openImagePreview(
                            formLocalImageUrl || form.selling_image_url,
                            form.business_name || "Selling image",
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-500/20"
                      >
                        <Eye className="h-4 w-4" />
                        View image
                      </button>

                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => {
                          updateForm("selling_image_url", "");
                          updateForm("selling_image_path", "");
                          setFormLocalImageUrl("");
                        }}
                        className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-100 transition hover:bg-red-500/20 disabled:opacity-60"
                      >
                        Remove image
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <textarea
                value={form.notes}
                onChange={(e) => updateForm("notes", e.target.value)}
                placeholder="Notes about this business"
                rows={5}
                className="resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <div className="grid gap-2">
                <CheckBox label="Active contact" checked={form.is_active} onChange={(checked) => updateForm("is_active", checked)} />
                <CheckBox label="Sent to checklist" checked={form.sent_to_checklist} onChange={(checked) => updateForm("sent_to_checklist", checked)} />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveContact}
                  disabled={saving || uploadingImage || !canEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : editingId ? "Update contact" : "Add contact"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving || uploadingImage}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-xl font-bold">Saved contacts</h2>
                <p className="mt-1 text-sm text-white/60">
                  {filteredContacts.length} contact{filteredContacts.length === 1 ? "" : "s"} found.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/35"
                  />
                </div>

                <select value={serviceTypeFilter} onChange={(e) => setServiceTypeFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
                  <option value="" className="bg-[#1f1030]">All service types</option>
                  {serviceTypes.map((type) => (
                    <option key={type} value={type} className="bg-[#1f1030]">{type}</option>
                  ))}
                </select>

                <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
                  {activeFilters.map((filter) => (
                    <option key={filter.value} value={filter.value} className="bg-[#1f1030]">{filter.label}</option>
                  ))}
                </select>

                <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
                  {ratingFilters.map((filter) => (
                    <option key={filter.value || "all"} value={filter.value} className="bg-[#1f1030]">{filter.label}</option>
                  ))}
                </select>

                <select value={dataFilter} onChange={(e) => setDataFilter(e.target.value)} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none">
                  {dataFilters.map((filter) => (
                    <option key={filter.value} value={filter.value} className="bg-[#1f1030]">{filter.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading || eventLoading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                Loading contacts...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-white/60">
                No business contacts found for this event.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredContacts.map((contact) => {
                  const contactImageUrl = getContactImageUrl(contact);

                  return (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      imageUrl={contactImageUrl}
                      locked={!canEdit}
                      actionLoading={actionId === contact.id}
                      onViewImage={() => handleViewContactImage(contact)}
                      onEmail={() => openEmailAppForContact(contact)}
                      onEdit={() => startEdit(contact)}
                      onDelete={() => setDeleteId(contact.id)}
                      onSendToChecklist={() => sendToChecklist(contact)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {imagePreview && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-5xl rounded-[32px] border border-white/10 bg-[#1b1028] shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
                <div>
                  <h2 className="text-xl font-extrabold text-white">{imagePreview.title}</h2>
                  <p className="mt-1 text-sm text-white/60">Selling image preview</p>
                </div>

                <button type="button" onClick={() => setImagePreview(null)} className="rounded-full border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/20" aria-label="Close image preview">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5">
                {imagePreview.missing ? (
                  <div className="rounded-3xl border border-yellow-400/20 bg-yellow-500/10 p-8 text-center text-yellow-100">
                    <ImagePlus className="mx-auto mb-4 h-10 w-10" />
                    <p className="text-lg font-extrabold">No image saved yet</p>
                    <p className="mt-2 text-sm text-yellow-50/80">{imagePreview.message}</p>
                  </div>
                ) : imagePreviewFailed ? (
                  <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-center text-red-100">
                    <p className="text-lg font-extrabold">Image could not load</p>
                    <p className="mt-2 text-sm text-red-50/80">
                      The popup is working, but the saved image URL could not be loaded by the browser.
                    </p>
                    {imagePreview?.url ? (
                      <a href={imagePreview.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90">
                        Open image in new tab
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <img src={imagePreview?.url ?? ""} alt={(imagePreview?.title ?? 'Image') + ' preview'} onError={() => setImagePreviewFailed(true)} className="max-h-[75vh] w-full rounded-2xl object-contain" />
                )}
              </div>

              <div className="flex justify-end border-t border-white/10 p-5">
                <button type="button" onClick={() => setImagePreview(null)} className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteId && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[32px] border border-red-500/20 bg-[#1b1028] shadow-2xl">
              <div className="border-b border-white/10 p-6">
                <h2 className="text-xl font-extrabold text-white">Delete business contact?</h2>
                <p className="mt-2 text-sm text-white/60">This will permanently remove this contact from the Event Hub.</p>
              </div>

              <div className="p-6">
                <p className="text-sm text-white/75">
                  Are you sure you want to delete this business contact? This action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 p-6">
                <button type="button" onClick={() => setDeleteId(null)} disabled={saving} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60">
                  Cancel
                </button>

                <button type="button" onClick={confirmDelete} disabled={saving || !canEdit} className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60">
                  {saving ? "Deleting..." : "Delete contact"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  warning = false,
  good = false,
  danger = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
  good?: boolean;
  danger?: boolean;
}) {
  const colour = danger
    ? "border-red-400/25 bg-red-500/10"
    : good
      ? "border-emerald-400/20 bg-emerald-500/10"
      : warning
        ? "border-amber-400/20 bg-amber-500/10"
        : "border-white/10 bg-white/10";

  return (
    <div className={`rounded-3xl border p-5 ${colour}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-white/75">
        {label}{required ? <span className="text-red-300"> *</span> : null}
      </label>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || label} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35" />
    </div>
  );
}

function CheckBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="text-white/85">{label}</span>
    </label>
  );
}

function MiniStatus({ good, label }: { good: boolean; label: string }) {
  return good ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-100">
      <CheckCircle2 className="h-3.5 w-3.5" /> {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-100">
      <AlertTriangle className="h-3.5 w-3.5" /> {label}
    </span>
  );
}

function RatingBadge({ rating }: { rating?: ContactRating | null }) {
  if (rating === "good") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-100">
        <ThumbsUp className="h-3.5 w-3.5" />
        Good to work with
      </span>
    );
  }

  if (rating === "ok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-100">
        <CircleMinus className="h-3.5 w-3.5" />
        Okay
      </span>
    );
  }

  if (rating === "do_not_invite") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/15 px-3 py-1 text-xs font-black text-red-100">
        <Ban className="h-3.5 w-3.5" />
        Do not invite
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/50">
      Not rated
    </span>
  );
}

function ContactCard({
  contact,
  imageUrl,
  locked,
  actionLoading,
  onViewImage,
  onEmail,
  onEdit,
  onDelete,
  onSendToChecklist,
}: {
  contact: Contact;
  imageUrl: string;
  locked: boolean;
  actionLoading: boolean;
  onViewImage: () => void;
  onEmail: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSendToChecklist: () => void;
}) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.07] p-5 shadow-xl shadow-black/20 backdrop-blur-xl transition hover:border-white/15 hover:bg-white/[0.09]">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold text-white">{contact.business_name}</h3>

            {contact.service_type && (
              <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-100">
                {contact.service_type}
              </span>
            )}

            <RatingBadge rating={contact.working_rating} />
            {contact.is_active ? <MiniStatus good label="Active" /> : <MiniStatus good={false} label="Inactive" />}
            {contact.sent_to_checklist ? <MiniStatus good label="Checklist" /> : <MiniStatus good={false} label="Not checklist" />}
          </div>

          {contact.contact_name && <p className="mt-1 text-sm text-white/70">Contact: {contact.contact_name}</p>}

          {isDoNotInvite(contact) && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
              <Ban className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">Do not invite this contact</p>
                <p className="mt-1 text-xs leading-5 text-red-50/75">
                  Review the saved notes before changing this rating. Invitation
                  email and checklist actions are blocked.
                </p>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-2 text-sm text-white/70">
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-white/40" />
                <button type="button" onClick={onEmail} className="break-all text-left hover:text-white" title="Open in Burton Pride email app">
                  {contact.email}
                </button>
              </div>
            )}

            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-white/40" />
                <a href={`tel:${contact.phone}`} className="hover:text-white">{contact.phone}</a>
              </div>
            )}

            {contact.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-white/40" />
                <a href={normaliseWebsite(contact.website)} target="_blank" rel="noreferrer" className="break-all hover:text-white">
                  {contact.website}
                </a>
              </div>
            )}

            {contact.address && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-white/40" />
                <span>{contact.address}</span>
              </div>
            )}
          </div>

          {contact.selling && (
            <div className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
              <strong>What they are selling:</strong> {contact.selling}
            </div>
          )}

          {imageUrl ? (
            <div className="mt-4 max-w-sm rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-white">Selling image</p>
                <button type="button" onClick={onViewImage} className="rounded-xl border border-blue-400/25 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-500/20">
                  View
                </button>
              </div>
              <img src={imageUrl} alt={`${contact.business_name} selling image`} className="h-40 w-full rounded-2xl object-cover" />
            </div>
          ) : (
            <div className="mt-4 max-w-sm rounded-3xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-white/45">
              No selling image saved yet.
            </div>
          )}

          {contact.notes && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">{contact.notes}</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 xl:max-w-[300px] xl:justify-end">
          <button type="button" onClick={onViewImage} className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-500/20">
            <Eye className="h-4 w-4" />
            View image
          </button>

          <button
            type="button"
            onClick={onEmail}
            disabled={isDoNotInvite(contact)}
            title={
              isDoNotInvite(contact)
                ? "This contact is marked Do not invite"
                : "Prepare an invitation email"
            }
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Mail className="h-4 w-4" />
            Email
          </button>

          <button
            type="button"
            onClick={onSendToChecklist}
            disabled={
              locked ||
              actionLoading ||
              Boolean(contact.sent_to_checklist) ||
              isDoNotInvite(contact)
            }
            title={
              isDoNotInvite(contact)
                ? "This contact is marked Do not invite"
                : "Send to checklist"
            }
            className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {actionLoading
              ? "Sending..."
              : isDoNotInvite(contact)
                ? "Blocked"
                : contact.sent_to_checklist
                  ? "Sent"
                  : "Checklist"}
          </button>

          <button type="button" onClick={onEdit} disabled={locked} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
            <Edit className="h-4 w-4" />
            Edit
          </button>

          <button type="button" onClick={onDelete} disabled={locked} className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
