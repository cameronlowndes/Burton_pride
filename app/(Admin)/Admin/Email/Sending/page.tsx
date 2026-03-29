"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  History,
  Loader2,
  Mail,
  Paperclip,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";

type SendEmailResponse = {
  ok: boolean;
  error?: string;
  message?: string;
};

type DraftResponse = {
  ok: boolean;
  error?: string;
  message?: string;
};

type TemplateItem = {
  id: string;
  name: string;
  subject: string;
  message: string;
  html?: string | null;
};

type HistoryItem = {
  id: string;
  to: string;
  subject: string;
  created_at: string;
  status?: string | null;
};

type TemplatesResponse = {
  ok: boolean;
  templates?: TemplateItem[];
  error?: string;
};

type HistoryResponse = {
  ok: boolean;
  items?: HistoryItem[];
  error?: string;
};

type Notice =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

const initialForm = {
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  message: "",
  html: "",
};

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: string) {
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

function Input({
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
  rows = 10,
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

export default function AdminSendEmailPage() {
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [editorMode, setEditorMode] = useState<"plain" | "html">("plain");
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSend = useMemo(() => {
    const hasBody =
      editorMode === "html"
        ? form.html.trim().length > 0
        : form.message.trim().length > 0;

    return (
      form.to.trim().length > 0 &&
      form.subject.trim().length > 0 &&
      hasBody
    );
  }, [form, editorMode]);

  useEffect(() => {
    loadTemplates();
    loadHistory();
  }, []);

  async function loadTemplates() {
    try {
      setTemplatesLoading(true);
      const res = await fetch("/api/admin/email/templates", {
        cache: "no-store",
      });
      const data: TemplatesResponse = await res.json();
      if (res.ok && data.ok && data.templates) {
        setTemplates(data.templates);
      } else {
        setTemplates([]);
      }
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/admin/email/history", {
        cache: "no-store",
      });
      const data: HistoryResponse = await res.json();
      if (res.ok && data.ok && data.items) {
        setHistoryItems(data.items);
      } else {
        setHistoryItems([]);
      }
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function updateField<K extends keyof typeof initialForm>(
    key: K,
    value: (typeof initialForm)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function clearForm() {
    setForm(initialForm);
    setFiles([]);
    setNotice(null);
    setShowHtmlPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;

    const nextFiles = Array.from(fileList);

    setFiles((prev) => {
      const merged = [...prev];

      for (const file of nextFiles) {
        const exists = merged.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified
        );

        if (!exists) merged.push(file);
      }

      return merged;
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    setForm((prev) => ({
      ...prev,
      subject: template.subject || prev.subject,
      message: template.message || prev.message,
      html: template.html || prev.html,
    }));

    if (template.html?.trim()) {
      setEditorMode("html");
    }
  }

  async function handleSaveDraft() {
    setNotice(null);

    if (!form.to.trim() || !form.subject.trim()) {
      setNotice({
        type: "error",
        message: "Please add at least To and Subject before saving a draft.",
      });
      return;
    }

    try {
      setSavingDraft(true);

      const formData = new FormData();
      formData.append("to", form.to);
      formData.append("cc", form.cc);
      formData.append("bcc", form.bcc);
      formData.append("subject", form.subject);
      formData.append("message", form.message);
      formData.append("html", form.html);
      formData.append("editorMode", editorMode);

      files.forEach((file) => {
        formData.append("attachments", file);
      });

      const res = await fetch("/api/admin/email/drafts", {
        method: "POST",
        body: formData,
      });

      const data: DraftResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save draft.");
      }

      setNotice({
        type: "success",
        message: data.message || "Draft saved successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save draft.",
      });
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (!canSend) {
      setNotice({
        type: "error",
        message: "Please fill in To, Subject, and the email content before sending.",
      });
      return;
    }

    try {
      setSending(true);

      const formData = new FormData();
      formData.append("to", form.to);
      formData.append("cc", form.cc);
      formData.append("bcc", form.bcc);
      formData.append("subject", form.subject);
      formData.append("message", form.message);
      formData.append("html", form.html);
      formData.append("editorMode", editorMode);

      files.forEach((file) => {
        formData.append("attachments", file);
      });

      const res = await fetch("/api/admin/email/send", {
        method: "POST",
        body: formData,
      });

      const data: SendEmailResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send email.");
      }

      setNotice({
        type: "success",
        message: data.message || "Email sent successfully.",
      });

      clearForm();
      await loadHistory();
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to send email.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-w-0 p-4 md:p-6 lg:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <section className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3">
              <Mail className="h-6 w-6 text-fuchsia-200" />
            </div>

            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                <Sparkles className="h-3.5 w-3.5" />
                Email composer
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Send Email
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65 md:text-base">
                Send single emails, use templates, save drafts, preview files,
                and see sent email history.
              </p>
            </div>
          </div>

          <NoticeBanner notice={notice} />

          <form onSubmit={handleSend} className="mt-6 space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <FieldLabel required>To</FieldLabel>
                <Input
                  value={form.to}
                  onChange={(value) => updateField("to", value)}
                  placeholder="name@example.com"
                  type="email"
                />
              </div>

              <div>
                <FieldLabel>Template</FieldLabel>
                <select
                  onChange={(e) => {
                    if (e.target.value) applyTemplate(e.target.value);
                  }}
                  defaultValue=""
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
                >
                  <option value="" disabled className="bg-slate-900 text-white">
                    {templatesLoading ? "Loading templates..." : "Pick a template"}
                  </option>
                  {templates.map((template) => (
                    <option
                      key={template.id}
                      value={template.id}
                      className="bg-slate-900 text-white"
                    >
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel>CC</FieldLabel>
                <Input
                  value={form.cc}
                  onChange={(value) => updateField("cc", value)}
                  placeholder="optional@email.com"
                  type="email"
                />
              </div>

              <div>
                <FieldLabel>BCC</FieldLabel>
                <Input
                  value={form.bcc}
                  onChange={(value) => updateField("bcc", value)}
                  placeholder="optional@email.com"
                  type="email"
                />
              </div>
            </div>

            <div>
              <FieldLabel required>Subject</FieldLabel>
              <Input
                value={form.subject}
                onChange={(value) => updateField("subject", value)}
                placeholder="Email subject"
              />
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <FieldLabel required>
                  {editorMode === "html" ? "HTML content" : "Message"}
                </FieldLabel>

                <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => setEditorMode("plain")}
                    className={clsx(
                      "rounded-xl px-3 py-2 text-sm transition",
                      editorMode === "plain"
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    Plain text
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode("html")}
                    className={clsx(
                      "rounded-xl px-3 py-2 text-sm transition",
                      editorMode === "html"
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    HTML
                  </button>
                </div>
              </div>

              {editorMode === "plain" ? (
                <TextArea
                  value={form.message}
                  onChange={(value) => updateField("message", value)}
                  placeholder="Write your email here..."
                  rows={12}
                />
              ) : (
                <div className="space-y-4">
                  <TextArea
                    value={form.html}
                    onChange={(value) => updateField("html", value)}
                    placeholder="<h1>Hello</h1><p>Your HTML email here...</p>"
                    rows={12}
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setShowHtmlPreview((prev) => !prev)}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
                    >
                      <Eye className="h-4 w-4" />
                      {showHtmlPreview ? "Hide preview" : "Show preview"}
                    </button>
                  </div>

                  {showHtmlPreview ? (
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white p-4 text-slate-900">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: form.html || "<p>No HTML content yet.</p>",
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <FieldLabel>Attachments</FieldLabel>

              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
                  >
                    <Upload className="h-4 w-4" />
                    Add files
                  </button>

                  <p className="text-sm text-white/55">
                    You can attach multiple files.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />

                {files.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {files.map((file, index) => {
                      const previewUrl = URL.createObjectURL(file);
                      const isImage = file.type.startsWith("image/");
                      const isPdf = file.type === "application/pdf";

                      return (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex items-center gap-3">
                              <div className="rounded-xl border border-white/10 bg-white/[0.05] p-2">
                                <Paperclip className="h-4 w-4 text-fuchsia-200" />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">
                                  {file.name}
                                </p>
                                <p className="text-xs text-white/50">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-100 transition hover:bg-rose-500/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {isImage ? (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2">
                              <img
                                src={previewUrl}
                                alt={file.name}
                                className="max-h-56 w-auto rounded-xl object-contain"
                              />
                            </div>
                          ) : isPdf ? (
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                              PDF attached: {file.name}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
                    No files attached yet.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={sending || !canSend}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/30 transition hover:from-fuchsia-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send email
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={savingDraft}
                onClick={handleSaveDraft}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 text-sm font-medium text-white transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingDraft ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving draft...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save draft
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={sending || savingDraft}
                onClick={clearForm}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 text-sm font-medium text-white transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear form
              </button>
            </div>
          </form>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                <Wand2 className="h-5 w-5 text-fuchsia-200" />
              </div>
              <h2 className="text-xl font-semibold text-white">Template picker</h2>
            </div>

            <div className="mt-4 space-y-3">
              {templatesLoading ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                  Loading templates...
                </div>
              ) : templates.length > 0 ? (
                templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                  >
                    <div className="text-sm font-semibold text-white">
                      {template.name}
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      {template.subject}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                  No templates found.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                <History className="h-5 w-5 text-fuchsia-200" />
              </div>
              <h2 className="text-xl font-semibold text-white">Sent email history</h2>
            </div>

            <div className="mt-4 space-y-3">
              {historyLoading ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                  Loading history...
                </div>
              ) : historyItems.length > 0 ? (
                historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-white">
                      {item.subject}
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      To: {item.to}
                    </div>
                    <div className="mt-1 text-xs text-white/40">
                      {formatDate(item.created_at)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                  No sent email history yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                <FileText className="h-5 w-5 text-fuchsia-200" />
              </div>
              <h2 className="text-xl font-semibold text-white">Editor mode</h2>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
                Plain text and HTML editor are both built in.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
                Draft saving is ready from this screen.
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">
                Attachment preview is shown before sending.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}