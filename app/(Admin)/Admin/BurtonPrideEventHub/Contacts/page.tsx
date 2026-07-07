"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
  Edit,
  ImagePlus,
  Eye,
} from "lucide-react";

type Contact = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  service_type: string | null;
  selling: string | null;
  selling_image_url: string | null;
  notes: string | null;
  is_active: boolean;
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
  selling: string;
  selling_image_url: string;
  notes: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  business_name: "",
  contact_name: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  service_type: "",
  selling: "",
  selling_image_url: "",
  notes: "",
  is_active: true,
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

const IMAGE_CACHE_KEY = "event-hub-contact-image-urls";

function readCachedImages() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(IMAGE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeCachedImages(images: Record<string, string>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(images));
  } catch {
    // Local storage is only a backup. If it fails, the database save still matters.
  }
}

export default function EventHubContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [search, setSearch] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("");
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
  const [localImageUrls, setLocalImageUrls] = useState<Record<string, string>>(
    {},
  );

  const [cachedImageUrls, setCachedImageUrls] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    setCachedImageUrls(readCachedImages());
  }, []);

  async function readJson(res: Response): Promise<ApiResponse> {
    const text = await res.text();

    try {
      return text ? JSON.parse(text) : { ok: false };
    } catch {
      return {
        ok: false,
        error:
          "Server returned invalid JSON instead of the expected API response.",
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

    if (error.details) {
      baseDetails.push(`Server details: ${error.details}`);
    }

    if (status === 401) {
      baseDetails.push(
        "",
        "What this means:",
        "Your admin login session was not accepted by this API route.",
        "",
        "What to check:",
        "1. Sign out and sign back into the admin portal.",
        '2. Make sure the fetch request includes credentials: "include".',
        "3. Make sure the API route checks your Burton admin cookies or Supabase session.",
        "4. Check the cookies burton_admin_session, burton_admin_id, and burton_admin_email exist in the browser.",
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
        "2. For image uploads, only use JPG, PNG, WEBP, or GIF.",
        "3. Make sure the image is smaller than 5MB.",
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
        "4. Check the Supabase bucket name is event-hub-selling-images.",
        "5. Check the bucket exists and storage upload is allowed.",
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

  async function loadContacts() {
    try {
      setLoading(true);
      setNotice(null);

      const res = await fetch("/api/admin/burton-pride-event-hub/contacts", {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw createApiError({
          action: "Load saved contacts",
          endpoint: "/api/admin/burton-pride-event-hub/contacts",
          res,
          data,
          fallbackMessage: "Failed to load contacts.",
        });
      }

      const loadedContacts = data.contacts || [];
      setContacts(loadedContacts);

      const cached = readCachedImages();
      let changed = false;

      for (const contact of loadedContacts) {
        const imageUrl = (contact.selling_image_url || "").trim();

        if (imageUrl && cached[contact.id] !== imageUrl) {
          cached[contact.id] = imageUrl;
          changed = true;
        }
      }

      if (changed) {
        writeCachedImages(cached);
        setCachedImageUrls(cached);
      }
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
    loadContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const selectedType = serviceTypeFilter.trim().toLowerCase();

    return contacts.filter((contact) => {
      const serviceType = (contact.service_type || "").trim().toLowerCase();

      const matchesServiceType = !selectedType || serviceType === selectedType;

      const matchesSearch =
        !q ||
        contact.business_name.toLowerCase().includes(q) ||
        (contact.contact_name || "").toLowerCase().includes(q) ||
        (contact.email || "").toLowerCase().includes(q) ||
        (contact.phone || "").toLowerCase().includes(q) ||
        (contact.website || "").toLowerCase().includes(q) ||
        (contact.address || "").toLowerCase().includes(q) ||
        serviceType.includes(q) ||
        (contact.selling || "").toLowerCase().includes(q) ||
        (contact.selling_image_url || "").toLowerCase().includes(q) ||
        (contact.notes || "").toLowerCase().includes(q);

      return matchesServiceType && matchesSearch;
    });
  }, [contacts, search, serviceTypeFilter]);

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

    setLocalImageUrls((prev) => ({
      ...prev,
      [contactId]: cleanUrl,
    }));

    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId
          ? {
              ...contact,
              selling_image_url: contact.selling_image_url || cleanUrl,
            }
          : contact,
      ),
    );
  }

  function cacheContactImageUrl(contactId: string, imageUrl: string) {
    const cleanUrl = imageUrl.trim();

    if (!contactId || !cleanUrl) return;

    setCachedImageUrls((prev) => {
      const next = {
        ...prev,
        [contactId]: cleanUrl,
      };

      writeCachedImages(next);
      return next;
    });
  }

  function getContactImageUrl(contact: Contact) {
    const savedImageUrl = (contact.selling_image_url || "").trim();
    const localImageUrl = (localImageUrls[contact.id] || "").trim();
    const cachedImageUrl = (cachedImageUrls[contact.id] || "").trim();
    const editingFormImageUrl =
      editingId === contact.id ? form.selling_image_url.trim() : "";
    const editingLocalImageUrl =
      editingId === contact.id ? formLocalImageUrl.trim() : "";

    // Priority matters:
    // 1. Local selected file, so the button pops immediately even before upload finishes.
    // 2. Database URL, so saved contacts work after refresh.
    // 3. Form URL and browser cache as backups.
    return (
      editingLocalImageUrl ||
      localImageUrl ||
      savedImageUrl ||
      editingFormImageUrl ||
      cachedImageUrl
    );
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

  function openEmailAppForContact(contact: Contact) {
    const email = (contact.email || "").trim();

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

    const contactName = (contact.contact_name || "").trim();
    const businessName = contact.business_name.trim();
    const serviceType = (contact.service_type || "").trim();

    const selling = (contact.selling || "").trim();

    const subject = serviceType
      ? `Invitation to Burton Pride - ${businessName}`
      : `Invitation to Burton Pride - ${businessName}`;

    const body = [
      `Hello ${contactName || businessName},`,
      "",
      "I hope you are well.",
      "",
      `We are getting in touch from Burton Pride C.I.C. to invite ${businessName} back to be part of Burton Pride.`,
      "",
      serviceType
        ? `We currently have you listed in our Event Hub as: ${serviceType}.`
        : "We currently have you saved as a contact in our Event Hub.",
      selling ? `We also have you noted as selling/providing: ${selling}.` : "",
      "",
      "We would love to welcome you back and have you involved again as part of our community Pride event.",
      "",
      "Please could you let us know if you would be interested in joining us again. It would also be helpful if you could confirm that your contact details are still correct and let us know if anything needs updating.",
      "",
      "If you have any requirements, access needs, setup notes, or questions, please include them in your reply so our committee team can plan everything properly.",
      "",
      "Thank you for your continued support. Burton Pride is only possible because of the amazing businesses, vendors, charities, and community partners who support the event.",
      "",
      "Kind regards,",
      "Burton Pride C.I.C.",
    ]
      .filter(Boolean)
      .join("\n");

    const params = new URLSearchParams({
      to: email,
      subject,
      body,
      contactId: contact.id,
      businessName,
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
      selling: contact.selling || "",
      selling_image_url: contact.selling_image_url || "",
      notes: contact.notes || "",
      is_active: Boolean(contact.is_active),
    });

    setFormLocalImageUrl(localImageUrls[contact.id] || "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refreshContactsKeepingImage(
    contactId: string,
    imageUrl: string,
  ) {
    const verifyRes = await fetch(
      "/api/admin/burton-pride-event-hub/contacts",
      {
        cache: "no-store",
        credentials: "include",
      },
    );

    const verifyData = await readJson(verifyRes);

    if (!verifyRes.ok || !verifyData.ok) {
      // The button should still work because the URL is already cached locally.
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === contactId
            ? { ...contact, selling_image_url: imageUrl }
            : contact,
        ),
      );
      return;
    }

    const loadedContacts = verifyData.contacts || [];

    setContacts(
      loadedContacts.map((contact) =>
        contact.id === contactId && !contact.selling_image_url
          ? { ...contact, selling_image_url: imageUrl }
          : contact,
      ),
    );
  }

  async function saveImageUrlToContact(contactId: string, imageUrl: string) {
    const cleanImageUrl = imageUrl.trim();

    if (!contactId || !cleanImageUrl) return;

    cacheContactImageUrl(contactId, cleanImageUrl);

    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId
          ? { ...contact, selling_image_url: cleanImageUrl }
          : contact,
      ),
    );

    const updatedForm = {
      ...form,
      selling_image_url: cleanImageUrl,
    };

    const res = await fetch("/api/admin/burton-pride-event-hub/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: contactId,
        ...updatedForm,
      }),
      credentials: "include",
    });

    const data = await readJson(res);

    if (!res.ok || !data.ok) {
      throw createApiError({
        action: "Save uploaded image URL to contact",
        endpoint: "/api/admin/burton-pride-event-hub/contacts",
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

      if (editingId) {
        rememberLocalContactImage(editingId, localPreviewUrl);
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        "/api/admin/burton-pride-event-hub/contacts/event-hub-selling-images",
        {
          method: "POST",
          body: formData,
          credentials: "include",
        },
      );

      const data = await readJson(res);

      if (!res.ok || !data.ok || !data.url) {
        throw createApiError({
          action: "Upload selling image",
          endpoint:
            "/api/admin/burton-pride-event-hub/contacts/event-hub-selling-images",
          res,
          data,
          fallbackMessage: "Failed to upload image.",
        });
      }

      const uploadedImageUrl = data.url.trim();

      setForm((prev) => ({
        ...prev,
        selling_image_url: uploadedImageUrl,
      }));

      setFormLocalImageUrl(uploadedImageUrl);

      if (editingId && uploadedImageUrl) {
        setContacts((prev) =>
          prev.map((contact) =>
            contact.id === editingId
              ? { ...contact, selling_image_url: uploadedImageUrl }
              : contact,
          ),
        );

        await saveImageUrlToContact(editingId, uploadedImageUrl);

        setNotice({
          type: "success",
          title: "Image uploaded and saved",
          message:
            "The image has been uploaded and attached to this contact. The View image button will work now.",
          details:
            "The image URL has been saved to the contact and also cached in this browser as a backup.",
        });

        return;
      }

      setNotice({
        type: "success",
        title: "Image uploaded",
        message:
          "Selling image uploaded successfully. Click Add contact to save it to the new contact.",
        details:
          "The image URL has been added to the form. Because this is a new contact, it will be saved when you click Add contact.",
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

  async function saveContact() {
    try {
      setSaving(true);
      setNotice(null);

      if (!form.business_name.trim()) {
        throw createLocalError(
          "Validate contact form",
          "Please enter the business name.",
          "The business name is required before this contact can be saved.",
        );
      }

      const payload = {
        id: editingId || undefined,
        ...form,
      };

      const res = await fetch("/api/admin/burton-pride-event-hub/contacts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw createApiError({
          action: editingId
            ? "Update business contact"
            : "Add business contact",
          endpoint: "/api/admin/burton-pride-event-hub/contacts",
          res,
          data,
          fallbackMessage: "Failed to save contact.",
        });
      }

      const savedContactId = editingId || data.contact?.id;
      const expectedImageUrl = form.selling_image_url.trim();
      const temporaryImageUrl = formLocalImageUrl.trim();

      if (savedContactId && expectedImageUrl) {
        cacheContactImageUrl(savedContactId, expectedImageUrl);
        await refreshContactsKeepingImage(savedContactId, expectedImageUrl);
      } else {
        await loadContacts();

        if (savedContactId && temporaryImageUrl) {
          rememberLocalContactImage(savedContactId, temporaryImageUrl);
        }
      }

      setNotice({
        type: "success",
        title: editingId ? "Contact updated" : "Contact added",
        message: editingId
          ? "Business contact updated successfully."
          : "Business contact added successfully.",
        details: expectedImageUrl
          ? "The View image button will now use the saved image URL for this contact."
          : undefined,
      });

      resetForm();
    } catch (error) {
      setNotice(
        buildErrorNotice(
          error,
          "Could not save contact",
          "Failed to save contact.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;

    try {
      setSaving(true);
      setNotice(null);

      const res = await fetch("/api/admin/burton-pride-event-hub/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteId }),
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw createApiError({
          action: "Delete business contact",
          endpoint: "/api/admin/burton-pride-event-hub/contacts",
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

      if (editingId === deleteId) {
        resetForm();
      }

      setDeleteId(null);
      await loadContacts();
    } catch (error) {
      setNotice(
        buildErrorNotice(
          error,
          "Could not delete contact",
          "Failed to delete contact.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.22),_transparent_32%),linear-gradient(180deg,#12091f_0%,#24113a_48%,#111827_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6 rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-pink-100">
                <Building2 className="h-4 w-4" />
                Event Hub
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight">
                Business Contacts
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-white/70">
                Store suppliers, vendors, sponsors, venues, entertainers,
                charities, contractors, and community partners for Burton Pride
                event planning.
              </p>
            </div>

            <button
              type="button"
              onClick={loadContacts}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

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

        <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-4 text-xl font-bold">
              {editingId ? "Edit business contact" : "Add business contact"}
            </h2>

            <div className="grid gap-4">
              <input
                value={form.business_name}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    business_name: e.target.value,
                  }))
                }
                placeholder="Business name"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <input
                value={form.contact_name}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    contact_name: e.target.value,
                  }))
                }
                placeholder="Contact person"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <input
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                placeholder="Email address"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                placeholder="Phone number"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <input
                value={form.website}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    website: e.target.value,
                  }))
                }
                placeholder="Website"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <input
                value={form.address}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
                placeholder="Address"
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <select
                value={form.service_type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    service_type: e.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              >
                <option value="">Select service type</option>
                {serviceTypes.map((type) => (
                  <option key={type} value={type} className="bg-[#1f1030]">
                    {type}
                  </option>
                ))}
              </select>

              <textarea
                value={form.selling}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    selling: e.target.value,
                  }))
                }
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
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadSellingImage(file);
                  }}
                  className="w-full text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-black disabled:opacity-60"
                />

                {uploadingImage && (
                  <p className="mt-3 text-xs font-semibold text-pink-100">
                    Uploading image...
                  </p>
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
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            selling_image_url: "",
                          }));
                          setFormLocalImageUrl("");
                        }}
                        className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-100 transition hover:bg-red-500/20"
                      >
                        Remove image
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Notes about this business"
                rows={5}
                className="resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      is_active: e.target.checked,
                    }))
                  }
                />
                Active contact
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveContact}
                  disabled={saving || uploadingImage}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update contact"
                      : "Add contact"}
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
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold">Saved contacts</h2>
                <p className="mt-1 text-sm text-white/60">
                  {filteredContacts.length} contact
                  {filteredContacts.length === 1 ? "" : "s"} found.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, email, selling, notes, or service..."
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/35 md:w-72"
                  />
                </div>

                <select
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none md:w-56"
                >
                  <option value="" className="bg-[#1f1030]">
                    All service types
                  </option>
                  {serviceTypes.map((type) => (
                    <option key={type} value={type} className="bg-[#1f1030]">
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                Loading contacts...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-white/60">
                No business contacts found yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredContacts.map((contact) => {
                  const contactImageUrl = getContactImageUrl(contact);

                  return (
                    <div
                      key={contact.id}
                      className="rounded-3xl border border-white/10 bg-black/20 p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-extrabold text-white">
                              {contact.business_name}
                            </h3>

                            {contact.service_type && (
                              <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-100">
                                {contact.service_type}
                              </span>
                            )}

                            {contact.is_active ? (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                                Active
                              </span>
                            ) : (
                              <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-100">
                                Inactive
                              </span>
                            )}
                          </div>

                          {contact.contact_name && (
                            <p className="mt-1 text-sm text-white/70">
                              Contact: {contact.contact_name}
                            </p>
                          )}

                          <div className="mt-4 grid gap-2 text-sm text-white/70">
                            {contact.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-white/40" />
                                <button
                                  type="button"
                                  onClick={() => openEmailAppForContact(contact)}
                                  className="break-all text-left hover:text-white"
                                  title="Open in Burton Pride email app"
                                >
                                  {contact.email}
                                </button>
                              </div>
                            )}

                            {contact.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-white/40" />
                                <a
                                  href={`tel:${contact.phone}`}
                                  className="hover:text-white"
                                >
                                  {contact.phone}
                                </a>
                              </div>
                            )}

                            {contact.website && (
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-white/40" />
                                <a
                                  href={contact.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="break-all hover:text-white"
                                >
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
                              <strong>What they are selling:</strong>{" "}
                              {contact.selling}
                            </div>
                          )}

                          {contactImageUrl && (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-white">
                                  Selling image
                                </p>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openImagePreview(
                                      contactImageUrl,
                                      contact.business_name,
                                    )
                                  }
                                  className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-500/20"
                                >
                                  <Eye className="h-4 w-4" />
                                  View image
                                </button>
                              </div>

                              <img
                                src={contactImageUrl}
                                alt={`${contact.business_name} selling image`}
                                className="max-h-40 w-full rounded-2xl object-cover"
                              />
                            </div>
                          )}

                          {contact.notes && (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                              {contact.notes}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewContactImage(contact)}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-100 transition hover:bg-blue-500/20"
                          >
                            <Eye className="h-4 w-4" />
                            View image
                          </button>

                          <button
                            type="button"
                            onClick={() => openEmailAppForContact(contact)}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/20"
                          >
                            <Mail className="h-4 w-4" />
                            Email
                          </button>

                          <button
                            type="button"
                            onClick={() => startEdit(contact)}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteId(contact.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 transition hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
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
                  <h2 className="text-xl font-extrabold text-white">
                    {imagePreview.title}
                  </h2>
                  <p className="mt-1 text-sm text-white/60">
                    Selling image preview
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="rounded-full border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/20"
                  aria-label="Close image preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5">
                {imagePreview.missing ? (
                  <div className="rounded-3xl border border-yellow-400/20 bg-yellow-500/10 p-8 text-center text-yellow-100">
                    <ImagePlus className="mx-auto mb-4 h-10 w-10" />
                    <p className="text-lg font-extrabold">No image saved yet</p>
                    <p className="mt-2 text-sm text-yellow-50/80">
                      {imagePreview.message}
                    </p>
                  </div>
                ) : imagePreviewFailed ? (
                  <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-center text-red-100">
                    <p className="text-lg font-extrabold">
                      Image could not load
                    </p>
                    <p className="mt-2 text-sm text-red-50/80">
                      The popup is working, but the saved image URL could not be
                      loaded by the browser.
                    </p>
                    {imagePreview.url && (
                      <a
                        href={imagePreview.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90"
                      >
                        Open image in new tab
                      </a>
                    )}
                  </div>
                ) : (
                  <img
                    src={imagePreview.url}
                    alt={`${imagePreview.title} preview`}
                    onError={() => setImagePreviewFailed(true)}
                    className="max-h-[75vh] w-full rounded-2xl object-contain"
                  />
                )}
              </div>

              <div className="flex justify-end border-t border-white/10 p-5">
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90"
                >
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
                <h2 className="text-xl font-extrabold text-white">
                  Delete business contact?
                </h2>

                <p className="mt-2 text-sm text-white/60">
                  This will permanently remove this contact from the Event Hub.
                </p>
              </div>

              <div className="p-6">
                <p className="text-sm text-white/75">
                  Are you sure you want to delete this business contact? This
                  action cannot be undone.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 p-6">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  disabled={saving}
                  className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={saving}
                  className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                >
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
