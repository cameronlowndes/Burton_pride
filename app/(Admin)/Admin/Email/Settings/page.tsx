"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  Send,
  Settings,
  Shield,
  User,
  Link2,
  RefreshCw,
  Signature,
  Plus,
  Trash2,
  Star,
  Eye,
  X,
} from "lucide-react";

type Notice =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

type EmailSettings = {
  senderName: string;
  senderEmail: string;
  replyTo: string;
  defaultCc: string;
  defaultBcc: string;
  testEmail: string;
  googleConnected: boolean;
  googleEmail: string;
};

type SettingsResponse = {
  ok: boolean;
  settings?: Partial<EmailSettings>;
  error?: string;
};

type SaveResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};

type SignatureItem = {
  id: string;
  name: string;
  html: string;
  text: string;
  is_default?: boolean;
  created_at?: string;
};

type SignaturesResponse = {
  ok: boolean;
  signatures?: SignatureItem[];
  error?: string;
};

type SaveSignatureModalState = {
  open: boolean;
  name: string;
  html: string;
  text: string;
  isDefault: boolean;
};

const initialSettings: EmailSettings = {
  senderName: "",
  senderEmail: "",
  replyTo: "",
  defaultCc: "",
  defaultBcc: "",
  testEmail: "",
  googleConnected: false,
  googleEmail: "",
};

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function htmlToPlainText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function plainTextToHtml(value: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  return trimmed
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p>${block
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;")
          .replace(/\n/g, "<br />")}</p>`
    )
    .join("");
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSignatureHtml(signature?: SignatureItem) {
  if (!signature) return "";
  const html = (signature.html || "").trim();
  if (html) return html;
  return plainTextToHtml(signature.text || "");
}

function FieldLabel({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-sm font-medium text-white/85">
      {children}
      {required ? <span className="ml-1 text-rose-300">*</span> : null}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
    />
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;

  return (
    <div
      className={clsx(
        "rounded-2xl border px-4 py-3 text-sm",
        notice.type === "success"
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          : "border-rose-400/30 bg-rose-500/10 text-rose-100"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {notice.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
        </div>
        <p>{notice.message}</p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
          {icon}
        </div>

        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-7 text-white/55">{description}</p>
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </div>
  );
}

function SaveSignatureModal({
  state,
  onClose,
  onChange,
  onSubmit,
  saving,
}: {
  state: SaveSignatureModalState;
  onClose: () => void;
  onChange: (next: Partial<SaveSignatureModalState>) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  if (!state.open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0a1022] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">
              Save email signature
            </h3>
            <p className="mt-2 text-sm leading-7 text-white/60">
              Save multiple reusable signatures and choose one as the default.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <FieldLabel required>Signature name</FieldLabel>
            <TextInput
              value={state.name}
              onChange={(value) => onChange({ name: value })}
              placeholder="Example: Main Burton Pride signature"
            />
          </div>

          <div>
            <FieldLabel>Signature HTML</FieldLabel>
            <TextArea
              value={state.html}
              onChange={(value) => onChange({ html: value })}
              rows={8}
              placeholder="<p>Kind regards,<br /><strong>Burton Pride C.I.C</strong></p>"
            />
          </div>

          <div>
            <FieldLabel>Signature plain text</FieldLabel>
            <TextArea
              value={state.text}
              onChange={(value) => onChange({ text: value })}
              rows={5}
              placeholder={"Kind regards,\nBurton Pride C.I.C"}
            />
          </div>

          <label className="inline-flex items-center gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={state.isDefault}
              onChange={(e) => onChange({ isDefault: e.target.checked })}
              className="h-4 w-4 rounded border-white/20 bg-black/20"
            />
            Make this the default signature
          </label>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={saving || !state.name.trim()}
            onClick={onSubmit}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 text-sm font-semibold text-white transition hover:from-fuchsia-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save signature
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettings>(initialSettings);
  const [originalSettings, setOriginalSettings] =
    useState<EmailSettings>(initialSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [refreshingGoogle, setRefreshingGoogle] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [signatures, setSignatures] = useState<SignatureItem[]>([]);
  const [signaturesLoading, setSignaturesLoading] = useState(true);
  const [savingSignature, setSavingSignature] = useState(false);
  const [selectedSignatureId, setSelectedSignatureId] = useState("");
  const [previewSignatureId, setPreviewSignatureId] = useState("");

  const [saveSignatureModal, setSaveSignatureModal] =
    useState<SaveSignatureModalState>({
      open: false,
      name: "",
      html: "",
      text: "",
      isDefault: false,
    });

  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  const selectedPreviewSignature = useMemo(() => {
    return (
      signatures.find((item) => item.id === previewSignatureId) ||
      signatures.find((item) => item.id === selectedSignatureId) ||
      signatures.find((item) => item.is_default) ||
      signatures[0]
    );
  }, [previewSignatureId, selectedSignatureId, signatures]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function loadAll() {
    await Promise.all([loadSettings(), loadSignatures()]);
  }

  async function loadSettings() {
    try {
      setLoading(true);
      setNotice(null);

      const res = await fetch("/api/admin/email/settings", {
        cache: "no-store",
      });

      const data: SettingsResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load email settings.");
      }

      const nextSettings: EmailSettings = {
        ...initialSettings,
        ...data.settings,
      };

      setSettings(nextSettings);
      setOriginalSettings(nextSettings);
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load email settings.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadSignatures() {
    try {
      setSignaturesLoading(true);

      const res = await fetch("/api/admin/email/signatures", {
        cache: "no-store",
      });

      const data: SignaturesResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load signatures.");
      }

      const nextSignatures = (data.signatures || []).map((item) => ({
        ...item,
        html: (item.html || "").trim() || plainTextToHtml(item.text || ""),
        text: (item.text || "").trim() || htmlToPlainText(item.html || ""),
      }));

      setSignatures(nextSignatures);

      const defaultSignature =
        nextSignatures.find((item) => item.is_default) || nextSignatures[0];

      setSelectedSignatureId(defaultSignature?.id || "");
      setPreviewSignatureId((prev) => prev || defaultSignature?.id || "");
    } catch (error) {
      setSignatures([]);
      setSelectedSignatureId("");
      setPreviewSignatureId("");
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load signatures.",
      });
    } finally {
      setSignaturesLoading(false);
    }
  }

  function updateField<K extends keyof EmailSettings>(
    key: K,
    value: EmailSettings[K]
  ) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setNotice(null);

      const res = await fetch("/api/admin/email/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          senderName: settings.senderName,
          senderEmail: settings.senderEmail,
          replyTo: settings.replyTo,
          defaultCc: settings.defaultCc,
          defaultBcc: settings.defaultBcc,
          testEmail: settings.testEmail,
        }),
      });

      const data: SaveResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save email settings.");
      }

      setOriginalSettings(settings);
      setNotice({
        type: "success",
        message: data.message || "Email settings saved successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save email settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTestEmail() {
    try {
      setSendingTest(true);
      setNotice(null);

      const res = await fetch("/api/admin/email/settings/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: settings.testEmail,
        }),
      });

      const data: SaveResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send test email.");
      }

      setNotice({
        type: "success",
        message:
          data.message ||
          `Test email sent successfully to ${settings.testEmail}.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to send test email.",
      });
    } finally {
      setSendingTest(false);
    }
  }

  async function handleRefreshGoogleStatus() {
    try {
      setRefreshingGoogle(true);
      setNotice(null);

      const res = await fetch("/api/admin/email/settings", {
        cache: "no-store",
      });

      const data: SettingsResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to refresh Google status.");
      }

      const nextSettings: EmailSettings = {
        ...initialSettings,
        ...data.settings,
      };

      setSettings(nextSettings);
      setOriginalSettings(nextSettings);

      setNotice({
        type: "success",
        message: "Google connection status refreshed.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to refresh Google status.",
      });
    } finally {
      setRefreshingGoogle(false);
    }
  }

  function connectGoogle() {
    window.location.href = "/api/admin/google/connect";
  }

  function openSaveSignatureModal() {
    setSaveSignatureModal({
      open: true,
      name: "",
      html: "",
      text: "",
      isDefault: signatures.length === 0,
    });
  }

  function closeSaveSignatureModal() {
    setSaveSignatureModal({
      open: false,
      name: "",
      html: "",
      text: "",
      isDefault: false,
    });
  }

  async function handleSaveSignature() {
    const name = saveSignatureModal.name.trim();
    const rawHtml = saveSignatureModal.html.trim();
    const rawText = saveSignatureModal.text.trim();

    if (!name) {
      setNotice({
        type: "error",
        message: "Please add a signature name.",
      });
      return;
    }

    if (!rawHtml && !rawText) {
      setNotice({
        type: "error",
        message: "Please add signature HTML or plain text.",
      });
      return;
    }

    const finalHtml = rawHtml || plainTextToHtml(rawText);
    const finalText = rawText || htmlToPlainText(rawHtml);

    try {
      setSavingSignature(true);
      setNotice(null);

      const res = await fetch("/api/admin/email/signatures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          html: finalHtml,
          text: finalText,
          isDefault: saveSignatureModal.isDefault,
        }),
      });

      const data: SaveResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save signature.");
      }

      await loadSignatures();
      closeSaveSignatureModal();

      setNotice({
        type: "success",
        message: data.message || `Signature "${name}" saved successfully.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save signature.",
      });
    } finally {
      setSavingSignature(false);
    }
  }

  async function handleDeleteSignature(id: string) {
    try {
      setNotice(null);

      const res = await fetch(`/api/admin/email/signatures/${id}`, {
        method: "DELETE",
      });

      const data: SaveResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete signature.");
      }

      await loadSignatures();

      setNotice({
        type: "success",
        message: data.message || "Signature deleted successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete signature.",
      });
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a1022]/80 px-5 py-4 text-white shadow-2xl">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading email settings...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 p-4 md:p-6 lg:p-8">
      <SaveSignatureModal
        state={saveSignatureModal}
        saving={savingSignature}
        onClose={closeSaveSignatureModal}
        onChange={(next) =>
          setSaveSignatureModal((prev) => ({
            ...prev,
            ...next,
          }))
        }
        onSubmit={handleSaveSignature}
      />

      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3">
                <Settings className="h-6 w-6 text-fuchsia-200" />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  <Mail className="h-3.5 w-3.5" />
                  Gmail-style settings
                </div>

                <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                  Email Settings
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60 md:text-base">
                  Manage sender details, Google connection, saved signatures,
                  and test delivery settings.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={sendingTest || !settings.testEmail.trim()}
                className="inline-flex min-h-[50px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 text-sm font-medium text-white transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending test...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send test email
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="inline-flex min-h-[50px] items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/30 transition hover:from-fuchsia-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save settings
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <NoticeBanner notice={notice} />
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-6">
            <SectionCard
              title="Sender details"
              description="These boxes stay blank until a Google account is connected."
              icon={<User className="h-5 w-5 text-fuchsia-200" />}
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <FieldLabel>Sender name</FieldLabel>
                  <TextInput
                    value={settings.senderName}
                    onChange={(value) => updateField("senderName", value)}
                    placeholder="Connect Google first"
                  />
                </div>

                <div>
                  <FieldLabel>Sender email</FieldLabel>
                  <TextInput
                    value={settings.senderEmail}
                    onChange={(value) => updateField("senderEmail", value)}
                    placeholder="Connect Google first"
                    type="email"
                  />
                </div>

                <div>
                  <FieldLabel>Reply-to email</FieldLabel>
                  <TextInput
                    value={settings.replyTo}
                    onChange={(value) => updateField("replyTo", value)}
                    placeholder="Connect Google first"
                    type="email"
                  />
                </div>

                <div>
                  <FieldLabel>Test email address</FieldLabel>
                  <TextInput
                    value={settings.testEmail}
                    onChange={(value) => updateField("testEmail", value)}
                    placeholder="Connect Google first"
                    type="email"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Default recipients"
              description="Add email addresses that should be included automatically when useful."
              icon={<Link2 className="h-5 w-5 text-fuchsia-200" />}
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <FieldLabel>Default CC</FieldLabel>
                  <TextInput
                    value={settings.defaultCc}
                    onChange={(value) => updateField("defaultCc", value)}
                    placeholder="optional@email.com"
                    type="email"
                  />
                </div>

                <div>
                  <FieldLabel>Default BCC</FieldLabel>
                  <TextInput
                    value={settings.defaultBcc}
                    onChange={(value) => updateField("defaultBcc", value)}
                    placeholder="optional@email.com"
                    type="email"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Saved email signatures"
              description="Save multiple signatures, mark one as default, preview them, and remove old ones."
              icon={<Signature className="h-5 w-5 text-fuchsia-200" />}
            >
              <div className="mb-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openSaveSignatureModal}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                >
                  <Plus className="h-4 w-4" />
                  New signature
                </button>
              </div>

              {signaturesLoading ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                  Loading signatures...
                </div>
              ) : signatures.length > 0 ? (
                <div className="space-y-3">
                  {signatures.map((signature) => {
                    const isSelected = selectedSignatureId === signature.id;
                    const isPreviewing =
                      (previewSignatureId || selectedSignatureId) === signature.id;

                    return (
                      <div
                        key={signature.id}
                        className={clsx(
                          "rounded-2xl border p-4",
                          isSelected
                            ? "border-fuchsia-400/30 bg-fuchsia-500/10"
                            : "border-white/10 bg-black/20"
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">
                                {signature.name}
                              </p>

                              {signature.is_default ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                                  <Star className="h-3 w-3" />
                                  Default
                                </span>
                              ) : null}

                              {isSelected ? (
                                <span className="inline-flex rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200">
                                  Active
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-2 text-xs text-white/45">
                              {signature.created_at
                                ? `Saved ${formatDate(signature.created_at)}`
                                : "Saved signature"}
                            </p>

                            <p className="mt-2 line-clamp-2 text-sm text-white/60">
                              {signature.text || htmlToPlainText(signature.html) || "No preview text"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedSignatureId(signature.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white transition hover:bg-white/[0.10]"
                            >
                              <Star className="h-3.5 w-3.5" />
                              Use as default view
                            </button>

                            <button
                              type="button"
                              onClick={() => setPreviewSignatureId(signature.id)}
                              className={clsx(
                                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition",
                                isPreviewing
                                  ? "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100"
                                  : "border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.10]"
                              )}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSignature(signature.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-500/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-white/60">
                  No signatures saved yet.
                </div>
              )}

              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white">
                <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-600">
                  Signature preview
                </div>

                <div className="p-4 text-slate-900">
                  <div
                    dangerouslySetInnerHTML={{
                      __html:
                        getSignatureHtml(selectedPreviewSignature) ||
                        "<p>No signature preview.</p>",
                    }}
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title="Google account connection"
              description="Check whether the Gmail account connection is working and refresh the connection if needed."
              icon={<Shield className="h-5 w-5 text-fuchsia-200" />}
            >
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Connection status
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                      {settings.googleConnected
                        ? "Your Google account is connected."
                        : "No Google account is connected right now."}
                    </p>

                    <p className="mt-2 text-xs text-white/45">
                      {settings.googleConnected && settings.googleEmail
                        ? `Connected as: ${settings.googleEmail}`
                        : "Connect a Google account first, then the sender boxes can fill from that account."}
                    </p>
                  </div>

                  <div
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      settings.googleConnected
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-rose-500/15 text-rose-200"
                    )}
                  >
                    {settings.googleConnected ? "Connected" : "Disconnected"}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={connectGoogle}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                  >
                    <Mail className="h-4 w-4" />
                    {settings.googleConnected
                      ? "Reconnect Google"
                      : "Connect Google"}
                  </button>

                  <button
                    type="button"
                    onClick={handleRefreshGoogleStatus}
                    disabled={refreshingGoogle}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refreshingGoogle ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Refresh status
                      </>
                    )}
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Settings summary"
              description="A quick view of the current active email configuration."
              icon={<Settings className="h-5 w-5 text-fuchsia-200" />}
            >
              <div className="space-y-3">
                {[
                  {
                    label: "Sender",
                    value:
                      settings.senderName || settings.senderEmail
                        ? `${settings.senderName || "No name"}${
                            settings.senderEmail
                              ? ` <${settings.senderEmail}>`
                              : ""
                          }`
                        : "Not set",
                  },
                  {
                    label: "Reply-to",
                    value: settings.replyTo || "Not set",
                  },
                  {
                    label: "Default CC",
                    value: settings.defaultCc || "Not set",
                  },
                  {
                    label: "Default BCC",
                    value: settings.defaultBcc || "Not set",
                  },
                  {
                    label: "Test email",
                    value: settings.testEmail || "Not set",
                  },
                  {
                    label: "Saved signatures",
                    value: `${signatures.length}`,
                  },
                  {
                    label: "Default signature",
                    value:
                      signatures.find((item) => item.is_default)?.name ||
                      signatures[0]?.name ||
                      "Not set",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      {item.label}
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Gmail-style tips"
              description="Useful notes for connected Google sending."
              icon={<Mail className="h-5 w-5 text-fuchsia-200" />}
            >
              <div className="grid gap-3">
                {[
                  "Leave sender boxes blank until a Google account is connected.",
                  "After Google connects, use that account details in the sender boxes.",
                  "Save more than one signature for different committee use.",
                  "Set one signature as the default when creating it.",
                  "Keep a test email saved so you can check sending quickly.",
                ].map((tip) => (
                  <div
                    key={tip}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75"
                  >
                    {tip}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}