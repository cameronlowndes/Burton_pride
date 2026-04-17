"use client";
//ready to go

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Bold,
  CheckCircle2,
  Eye,
  FileText,
  History,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Mail,
  Paperclip,
  Redo2,
  Save,
  Send,
  Sparkles,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  Upload,
  Wand2,
  X,
  Plus,
  Signature,
} from "lucide-react";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";

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

type ModalState =
  | { type: "link"; value: string }
  | { type: "image"; value: string }
  | null;

type SaveTemplateModalState = {
  open: boolean;
  name: string;
  subject: string;
};

type SaveSignatureModalState = {
  open: boolean;
  name: string;
  html: string;
  text: string;
  isDefault: boolean;
};

type SendProvider = "google" | "resend";

const initialForm = {
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  message: "",
  html: "",
};

const emailPresets = [
  {
    id: "announcement",
    name: "Announcement email",
    subject: "Important update from Burton Pride",
    html: `<div style="font-family:Arial,sans-serif;background:#f4f4f7;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:linear-gradient(90deg,#c026d3,#db2777,#7c3aed);padding:28px 24px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:28px;">Burton Pride Update</h1>
    </div>
    <div style="padding:28px 24px;color:#111827;line-height:1.7;">
      <p style="margin:0 0 16px;">Hello,</p>
      <p style="margin:0 0 16px;">We wanted to share an important update with you.</p>
      <p style="margin:0 0 24px;">Add your message here with all the details you want people to know.</p>
      <a href="#" style="display:inline-block;background:#db2777;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">Read more</a>
      <div style="height:24px;"></div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;">
      <div style="height:24px;"></div>
      <p style="margin:0;color:#6b7280;font-size:14px;">Kind regards,<br>Burton Pride C.I.C</p>
    </div>
  </div>
</div>`,
  },
  {
    id: "event",
    name: "Event email",
    subject: "Event update from Burton Pride",
    html: `<div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <img src="https://via.placeholder.com/1200x400" alt="Event banner" style="display:block;width:100%;height:auto;">
    <div style="padding:28px 24px;color:#111827;line-height:1.7;">
      <h1 style="margin:0 0 12px;font-size:28px;">Event name here</h1>
      <p style="margin:0 0 8px;"><strong>Date:</strong> Add date here</p>
      <p style="margin:0 0 16px;"><strong>Location:</strong> Add location here</p>
      <p style="margin:0 0 24px;">Add event details, timings, and what people need to know before attending.</p>
      <a href="#" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">Book now</a>
      <div style="height:24px;"></div>
      <p style="margin:0;color:#6b7280;font-size:14px;">Burton Pride C.I.C</p>
    </div>
  </div>
</div>`,
  },
  {
    id: "thankyou",
    name: "Thank you email",
    subject: "Thank you from Burton Pride",
    html: `<div style="font-family:Arial,sans-serif;background:#f4f4f7;padding:24px;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;padding:32px 24px;color:#111827;line-height:1.7;">
    <h1 style="margin:0 0 16px;font-size:28px;">Thank you</h1>
    <p style="margin:0 0 16px;">Hello,</p>
    <p style="margin:0 0 16px;">Thank you for your support and for being part of Burton Pride.</p>
    <p style="margin:0 0 24px;">You can personalise this message for volunteers, sponsors, supporters, or partners.</p>
    <div style="padding:16px;border-radius:12px;background:#f9fafb;border:1px solid #e5e7eb;">
      <p style="margin:0;">Add a special message here.</p>
    </div>
    <div style="height:24px;"></div>
    <p style="margin:0;color:#6b7280;font-size:14px;">Kind regards,<br>Burton Pride C.I.C</p>
  </div>
</div>`,
  },
];

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

function htmlToPlainText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainTextToHtml(value: string) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`);

  return paragraphs.join("");
}

function getSignatureHtml(signature?: SignatureItem) {
  if (!signature) return "";
  const html = (signature.html || "").trim();
  if (html) return html;
  return plainTextToHtml(signature.text || "");
}

function getSignatureText(signature?: SignatureItem) {
  if (!signature) return "";
  const text = (signature.text || "").trim();
  if (text) return text;
  return htmlToPlainText(signature.html || "");
}

function normalizeHtml(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripKnownSignaturesFromHtml(
  bodyHtml: string,
  signatureItems: SignatureItem[]
) {
  let next = (bodyHtml || "").trim();

  for (const item of signatureItems) {
    const possibleHtml = getSignatureHtml(item).trim();
    if (!possibleHtml) continue;

    const normalizedHtml = normalizeHtml(possibleHtml);
    if (!normalizedHtml) continue;

    if (normalizeHtml(next).includes(normalizedHtml)) {
      const escapedOriginal = escapeRegExp(possibleHtml)
        .replace(/\s+/g, "\\s*")
        .replace(/>\s*</g, ">\\s*<");

      next = next.replace(new RegExp(escapedOriginal, "gi"), "");
    }
  }

  next = next
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br /><br />")
    .replace(/^\s*(<br\s*\/?>\s*)+/gi, "")
    .replace(/(<br\s*\/?>\s*)+\s*$/gi, "")
    .trim();

  return next;
}

function stripKnownSignaturesFromText(
  bodyText: string,
  signatureItems: SignatureItem[]
) {
  let next = (bodyText || "").trim();

  for (const item of signatureItems) {
    const text = getSignatureText(item).trim();
    if (!text) continue;

    const escapedText = escapeRegExp(text).replace(/\s+/g, "\\s+");
    next = next.replace(new RegExp(escapedText, "gi"), "");
  }

  next = next.replace(/\n{3,}/g, "\n\n").trim();

  return next;
}

function appendSignatureHtmlToBottom(
  bodyHtml: string,
  signatureHtml: string,
  signatureItems: SignatureItem[]
) {
  const cleanSignature = (signatureHtml || "").trim();
  if (!cleanSignature) {
    return stripKnownSignaturesFromHtml(bodyHtml || "", signatureItems);
  }

  const bodyWithoutAnySignature = stripKnownSignaturesFromHtml(
    bodyHtml || "",
    signatureItems
  );

  const isBodyEmpty =
    !bodyWithoutAnySignature ||
    bodyWithoutAnySignature === "<p></p>" ||
    bodyWithoutAnySignature === "<p></p><p></p>" ||
    htmlToPlainText(bodyWithoutAnySignature).trim().length === 0;

  if (isBodyEmpty) {
    return cleanSignature;
  }

  return `${bodyWithoutAnySignature}<br /><br />${cleanSignature}`;
}

function appendSignatureTextToBottom(
  bodyText: string,
  signatureText: string,
  signatureItems: SignatureItem[]
) {
  const cleanSignature = (signatureText || "").trim();
  if (!cleanSignature) {
    return stripKnownSignaturesFromText(bodyText || "", signatureItems);
  }

  const bodyWithoutAnySignature = stripKnownSignaturesFromText(
    bodyText || "",
    signatureItems
  );

  if (!bodyWithoutAnySignature) {
    return cleanSignature;
  }

  return `${bodyWithoutAnySignature}\n\n${cleanSignature}`;
}

function buildBodyWithSelectedSignature(
  bodyHtml: string,
  bodyText: string,
  selectedSignature: SignatureItem | undefined,
  allSignatures: SignatureItem[]
) {
  const signatureHtml = getSignatureHtml(selectedSignature);
  const signatureText = getSignatureText(selectedSignature);

  const finalHtml = appendSignatureHtmlToBottom(
    bodyHtml || "",
    signatureHtml,
    allSignatures
  );

  const finalText = appendSignatureTextToBottom(
    bodyText || "",
    signatureText,
    allSignatures
  );

  return {
    finalHtml,
    finalText,
  };
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
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
          {icon}
        </div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  active = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={onClick}
      className={clsx(
        "inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm transition",
        active
          ? "border-fuchsia-400/40 bg-fuchsia-500/20 text-white"
          : "border-white/10 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
      )}
    >
      {children}
    </button>
  );
}

function EditorActionModal({
  modal,
  onClose,
  onChange,
  onSubmit,
}: {
  modal: ModalState;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!modal) return null;

  const isLink = modal.type === "link";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a1022] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">
              {isLink ? "Add link" : "Add image"}
            </h3>
            <p className="mt-2 text-sm leading-7 text-white/60">
              {isLink
                ? "Enter the URL you want to use."
                : "Enter the image URL you want to insert into the email."}
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

        <div className="mt-5">
          <FieldLabel>{isLink ? "URL" : "Image URL"}</FieldLabel>
          <input
            autoFocus
            type="text"
            value={modal.value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit();
              if (e.key === "Escape") onClose();
            }}
          />
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
            onClick={onSubmit}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 text-sm font-semibold text-white transition hover:from-fuchsia-500 hover:to-pink-500"
          >
            {isLink ? "Save link" : "Insert image"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveTemplateModal({
  state,
  onClose,
  onChange,
  onSubmit,
  saving,
}: {
  state: SaveTemplateModalState;
  onClose: () => void;
  onChange: (next: Partial<SaveTemplateModalState>) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  if (!state.open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a1022] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">Save new template</h3>
            <p className="mt-2 text-sm leading-7 text-white/60">
              Save the current subject and email body as a reusable template.
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
            <FieldLabel required>Template name</FieldLabel>
            <input
              autoFocus
              type="text"
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Example: Sponsor thank you"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
            />
          </div>

          <div>
            <FieldLabel>Subject</FieldLabel>
            <input
              type="text"
              value={state.subject}
              onChange={(e) => onChange({ subject: e.target.value })}
              placeholder="Template subject"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
            />
          </div>
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
                Save template
              </>
            )}
          </button>
        </div>
      </div>
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
              Save multiple reusable signatures and pick the one you want when sending emails.
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
            <input
              autoFocus
              type="text"
              value={state.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Example: Main Burton Pride signature"
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
            />
          </div>

          <div>
            <FieldLabel>Signature HTML</FieldLabel>
            <textarea
              value={state.html}
              onChange={(e) => onChange({ html: e.target.value })}
              rows={8}
              placeholder="<p>Kind regards,<br /><strong>Burton Pride C.I.C</strong></p>"
              className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
            />
          </div>

          <div>
            <FieldLabel>Signature plain text</FieldLabel>
            <textarea
              value={state.text}
              onChange={(e) => onChange({ text: e.target.value })}
              rows={5}
              placeholder={"Kind regards,\nBurton Pride C.I.C"}
              className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
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

function RichEditorToolbar({
  editor,
  openLinkModal,
  openImageModal,
}: {
  editor: Editor | null;
  openLinkModal: () => void;
  openImageModal: () => void;
}) {
  const run = (action: (ed: Editor) => void) => {
    if (!editor) return;
    action(editor);
  };

  const applyColor = (color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
  };

  const applyHighlight = (color: string) => {
    if (!editor) return;
    editor.chain().focus().toggleHighlight({ color }).run();
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-white">Rich editor toolbar</p>
        <p className="text-xs text-white/50">
          You can click buttons even before typing, then start writing.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ToolbarButton title="Undo" onClick={() => run((ed) => ed.chain().focus().undo().run())}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Redo" onClick={() => run((ed) => ed.chain().focus().redo().run())}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Bold"
          onClick={() => run((ed) => ed.chain().focus().toggleBold().run())}
          active={!!editor?.isActive("bold")}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Italic"
          onClick={() => run((ed) => ed.chain().focus().toggleItalic().run())}
          active={!!editor?.isActive("italic")}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Underline"
          onClick={() => run((ed) => ed.chain().focus().toggleUnderline().run())}
          active={!!editor?.isActive("underline")}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Heading 1"
          onClick={() =>
            run((ed) => {
              if (ed.isActive("heading", { level: 1 })) {
                ed.chain().focus().setParagraph().run();
              } else {
                ed.chain().focus().setHeading({ level: 1 }).run();
              }
            })
          }
          active={!!editor?.isActive("heading", { level: 1 })}
        >
          <span className="text-xs font-bold">H1</span>
        </ToolbarButton>

        <ToolbarButton
          title="Heading 2"
          onClick={() =>
            run((ed) => {
              if (ed.isActive("heading", { level: 2 })) {
                ed.chain().focus().setParagraph().run();
              } else {
                ed.chain().focus().setHeading({ level: 2 }).run();
              }
            })
          }
          active={!!editor?.isActive("heading", { level: 2 })}
        >
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>

        <ToolbarButton
          title="Paragraph"
          onClick={() => run((ed) => ed.chain().focus().setParagraph().run())}
          active={!!editor?.isActive("paragraph")}
        >
          <Type className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Bullet list"
          onClick={() => run((ed) => ed.chain().focus().toggleBulletList().run())}
          active={!!editor?.isActive("bulletList")}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Numbered list"
          onClick={() => run((ed) => ed.chain().focus().toggleOrderedList().run())}
          active={!!editor?.isActive("orderedList")}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Add link"
          onClick={() => run(() => openLinkModal())}
          active={!!editor?.isActive("link")}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton title="Add image" onClick={() => run(() => openImageModal())}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Align left"
          onClick={() => run((ed) => ed.chain().focus().setTextAlign("left").run())}
          active={!!editor?.isActive({ textAlign: "left" })}
        >
          <span className="text-xs font-semibold">L</span>
        </ToolbarButton>

        <ToolbarButton
          title="Align center"
          onClick={() => run((ed) => ed.chain().focus().setTextAlign("center").run())}
          active={!!editor?.isActive({ textAlign: "center" })}
        >
          <span className="text-xs font-semibold">C</span>
        </ToolbarButton>

        <ToolbarButton
          title="Align right"
          onClick={() => run((ed) => ed.chain().focus().setTextAlign("right").run())}
          active={!!editor?.isActive({ textAlign: "right" })}
        >
          <span className="text-xs font-semibold">R</span>
        </ToolbarButton>

        <ToolbarButton
          title="Clear formatting"
          onClick={() =>
            run((ed) => {
              ed.chain().focus().unsetAllMarks().clearNodes().setColor("#111827").run();
            })
          }
        >
          <span className="text-xs font-semibold">Clear</span>
        </ToolbarButton>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["#111827", "#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa"].map(
          (color) => (
            <button
              key={color}
              type="button"
              title={`Text color ${color}`}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => applyColor(color)}
              className="h-8 w-8 rounded-full border border-white/10"
              style={{ backgroundColor: color }}
            />
          )
        )}

        <ToolbarButton
          title="Reset text color to black"
          onClick={() => run((ed) => ed.chain().focus().setColor("#111827").run())}
        >
          <span className="text-xs font-semibold">Black</span>
        </ToolbarButton>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["#fef08a", "#fdba74", "#86efac", "#93c5fd", "#f9a8d4"].map((color) => (
          <button
            key={color}
            type="button"
            title={`Highlight ${color}`}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => applyHighlight(color)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/85"
            style={{ backgroundColor: color }}
          >
            <span className="rounded bg-black/30 px-1 py-0.5 text-white">HL</span>
          </button>
        ))}

        <ToolbarButton
          title="Remove highlight"
          onClick={() => run((ed) => ed.chain().focus().unsetHighlight().run())}
        >
          <span className="text-xs font-semibold">No HL</span>
        </ToolbarButton>
      </div>
    </div>
  );
}

export default function AdminSendEmailPage() {
  const searchParams = useSearchParams();
  const replyPrefillAppliedRef = useRef(false);

  const replyToPrefill = searchParams.get("to") || "";
  const replySubjectPrefill = searchParams.get("subject") || "";
  const replyBodyPrefill = searchParams.get("body") || "";

  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [editorMode, setEditorMode] = useState<"rich" | "html">("rich");
  const [sendProvider, setSendProvider] = useState<SendProvider>("google");
  const signaturesDisabled = sendProvider === "resend";

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [signatures, setSignatures] = useState<SignatureItem[]>([]);
  const [signaturesLoading, setSignaturesLoading] = useState(true);
  const [selectedSignatureId, setSelectedSignatureId] = useState("");

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [saveTemplateModal, setSaveTemplateModal] = useState<SaveTemplateModalState>({
    open: false,
    name: "",
    subject: "",
  });

  const [saveSignatureModal, setSaveSignatureModal] = useState<SaveSignatureModalState>({
    open: false,
    name: "",
    html: "",
    text: "",
    isDefault: false,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color.configure({
        types: ["textStyle"],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Image,
      Placeholder.configure({
        placeholder: "Write your email here...",
      }),
    ],
    content: form.html || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "ProseMirror min-h-[320px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 outline-none focus:border-fuchsia-400/30",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setForm((prev) => ({
        ...prev,
        html: stripKnownSignaturesFromHtml(currentEditor.getHTML(), signatures),
        message: stripKnownSignaturesFromText(currentEditor.getText(), signatures),
      }));
    },
  });

  useEffect(() => {
    if (replyPrefillAppliedRef.current) return;
    if (!replyToPrefill && !replySubjectPrefill && !replyBodyPrefill) return;

    if (replyBodyPrefill && !editor) return;

    const nextHtml = replyBodyPrefill ? plainTextToHtml(replyBodyPrefill) : "";

    setForm((prev) => ({
      ...prev,
      to: prev.to || replyToPrefill,
      subject: prev.subject || replySubjectPrefill,
      message: prev.message || replyBodyPrefill,
      html: prev.html || nextHtml,
    }));

    if (editor && replyBodyPrefill) {
      editor.commands.setContent(nextHtml || "<p></p>", {
        emitUpdate: true,
      });
    }

    setEditorMode("rich");
    replyPrefillAppliedRef.current = true;
  }, [replyToPrefill, replySubjectPrefill, replyBodyPrefill, editor]);

  const selectedSignature = useMemo(() => {
    return signatures.find((item) => item.id === selectedSignatureId);
  }, [signatures, selectedSignatureId]);

  useEffect(() => {
    if (sendProvider === "resend") {
      setSelectedSignatureId("");
    }
  }, [sendProvider]);

  const previewHtml = useMemo(() => {
    const cleanedHtml = stripKnownSignaturesFromHtml(form.html || "", signatures);
    const cleanedText = stripKnownSignaturesFromText(form.message || "", signatures);

    if (sendProvider === "resend") {
      return cleanedHtml || plainTextToHtml(cleanedText);
    }

    return buildBodyWithSelectedSignature(
      cleanedHtml,
      cleanedText,
      selectedSignature,
      signatures
    ).finalHtml;
  }, [form.html, form.message, selectedSignature, signatures, sendProvider]);

  const canSend = useMemo(() => {
    const bodySource = previewHtml;
    return (
      form.to.trim().length > 0 &&
      form.subject.trim().length > 0 &&
      bodySource.replace(/<[^>]+>/g, "").trim().length > 0
    );
  }, [form.to, form.subject, previewHtml]);

  const canSaveTemplate = useMemo(() => {
    return (
      form.subject.trim().length > 0 ||
      form.html.replace(/<[^>]+>/g, "").trim().length > 0
    );
  }, [form.subject, form.html]);

  useEffect(() => {
    loadTemplates();
    loadHistory();
    loadSignatures();
  }, []);

  useEffect(() => {
    const nextPreviews = files.map((file) =>
      file.type.startsWith("image/") ? URL.createObjectURL(file) : ""
    );

    setFilePreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [files]);

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

  async function loadSignatures() {
    try {
      setSignaturesLoading(true);
      const res = await fetch("/api/admin/email/signatures", {
        cache: "no-store",
      });
      const data: SignaturesResponse = await res.json();

      if (res.ok && data.ok && data.signatures) {
        const nextSignatures = data.signatures.map((item) => ({
          ...item,
          html: (item.html || "").trim() || plainTextToHtml(item.text || ""),
          text: (item.text || "").trim() || htmlToPlainText(item.html || ""),
        }));

        setSignatures(nextSignatures);

        const defaultSignature =
          nextSignatures.find((item) => item.is_default) || nextSignatures[0];

        setSelectedSignatureId((prev) => {
          if (sendProvider === "resend") return "";
          if (prev && nextSignatures.some((item) => item.id === prev)) {
            return prev;
          }
          return defaultSignature?.id || "";
        });

        setForm((prev) => ({
          ...prev,
          html: stripKnownSignaturesFromHtml(prev.html, nextSignatures),
          message: stripKnownSignaturesFromText(prev.message, nextSignatures),
        }));

        if (editor) {
          const cleanedHtml = stripKnownSignaturesFromHtml(
            editor.getHTML() || "",
            nextSignatures
          );
          editor.commands.setContent(cleanedHtml || "<p></p>", {
            emitUpdate: true,
          });
        }
      } else {
        setSignatures([]);
        setSelectedSignatureId("");
      }
    } catch {
      setSignatures([]);
      setSelectedSignatureId("");
    } finally {
      setSignaturesLoading(false);
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

  function syncEditorContent(nextHtml: string) {
    if (!editor) return;
    const cleanedHtml = stripKnownSignaturesFromHtml(nextHtml || "", signatures);
    editor.commands.setContent(cleanedHtml || "<p></p>", {
      emitUpdate: true,
    });
  }

  function showSuccess(message: string) {
    setNotice({ type: "success", message });
  }

  function showError(message: string) {
    setNotice({ type: "error", message });
  }

  function connectGoogle() {
    window.location.href = "/api/admin/google/connect";
  }

  function clearForm() {
    setForm(initialForm);
    setFiles([]);
    setNotice(null);
    setShowHtmlPreview(false);
    setModal(null);
    setEditorMode("rich");
    setSelectedTemplateId("");
    replyPrefillAppliedRef.current = false;

    if (sendProvider === "resend") {
      setSelectedSignatureId("");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (editor) {
      editor.commands.setContent("<p></p>", {
        emitUpdate: true,
      });
    }
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

    const nextHtml = template.html || `<p>${escapeHtml(template.message || "")}</p>`;
    const cleanedHtml = stripKnownSignaturesFromHtml(nextHtml, signatures);

    setSelectedTemplateId(templateId);
    setForm((prev) => ({
      ...prev,
      subject: template.subject || prev.subject,
      message: stripKnownSignaturesFromText(
        template.message || htmlToPlainText(cleanedHtml),
        signatures
      ),
      html: cleanedHtml,
    }));

    syncEditorContent(cleanedHtml);
    setEditorMode("rich");
    showSuccess(`Template "${template.name}" applied.`);
  }

  function applyPreset(presetId: string) {
    const preset = emailPresets.find((item) => item.id === presetId);
    if (!preset) return;

    const cleanedHtml = stripKnownSignaturesFromHtml(preset.html, signatures);

    setForm((prev) => ({
      ...prev,
      subject: prev.subject.trim() || preset.subject,
      html: cleanedHtml,
      message: htmlToPlainText(cleanedHtml),
    }));

    syncEditorContent(cleanedHtml);
    setShowHtmlPreview(true);
    setEditorMode("rich");
    showSuccess(`Preset "${preset.name}" loaded.`);
  }

  function openLinkModal() {
    if (!editor) return;
    const href = editor.getAttributes("link").href;
    const previousUrl = typeof href === "string" && href ? href : "https://";
    setModal({ type: "link", value: previousUrl });
  }

  function openImageModal() {
    setModal({ type: "image", value: "https://" });
  }

  function submitModal() {
    if (!editor || !modal) return;

    const value = modal.value.trim();

    if (!value) {
      if (modal.type === "link") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        setModal(null);
        showSuccess("Link removed.");
      } else {
        showError("Please add an image URL.");
      }
      return;
    }

    if (modal.type === "link") {
      editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
      setModal(null);
      showSuccess("Link added.");
      return;
    }

    editor.chain().focus().setImage({ src: value, alt: "Email image" }).run();
    setModal(null);
    showSuccess("Image inserted.");
  }

  function handleRawHtmlChange(value: string) {
    const cleanedHtml = stripKnownSignaturesFromHtml(value, signatures);

    setForm((prev) => ({
      ...prev,
      html: cleanedHtml,
      message: htmlToPlainText(cleanedHtml),
    }));
  }

  function applyRawHtmlToEditor() {
    if (!form.html.trim()) {
      showError("Please add some HTML first.");
      return;
    }

    syncEditorContent(form.html);
    setEditorMode("rich");
    showSuccess("HTML applied to the rich editor.");
  }

  function openSaveTemplateModal() {
    if (!canSaveTemplate) {
      showError("Add a subject or email content before saving a template.");
      return;
    }

    setSaveTemplateModal({
      open: true,
      name: form.subject.trim() || "",
      subject: form.subject.trim() || "",
    });
  }

  function closeSaveTemplateModal() {
    setSaveTemplateModal({
      open: false,
      name: "",
      subject: "",
    });
  }

  async function handleSaveTemplate() {
    const name = saveTemplateModal.name.trim();
    const subject = saveTemplateModal.subject.trim() || form.subject.trim();
    const html = stripKnownSignaturesFromHtml(form.html || editor?.getHTML() || "", signatures);
    const message = stripKnownSignaturesFromText(
      form.message || editor?.getText() || "",
      signatures
    );

    if (!name) {
      showError("Please add a template name.");
      return;
    }

    if (!html.replace(/<[^>]+>/g, "").trim()) {
      showError("Please add some email content before saving the template.");
      return;
    }

    try {
      setSavingTemplate(true);

      const res = await fetch("/api/admin/email/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          subject,
          message,
          html,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save template.");
      }

      await loadTemplates();
      closeSaveTemplateModal();
      showSuccess(data.message || `Template "${name}" saved successfully.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to save template.");
    } finally {
      setSavingTemplate(false);
    }
  }

  function openSaveSignatureModal() {
    if (sendProvider === "resend") {
      showError("Signatures are disabled when using Noreply (Resend).");
      return;
    }

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
      showError("Please add a signature name.");
      return;
    }

    if (!rawHtml && !rawText) {
      showError("Please add signature HTML or plain text.");
      return;
    }

    const finalHtml = rawHtml || plainTextToHtml(rawText);
    const finalText = rawText || htmlToPlainText(rawHtml);

    try {
      setSavingSignature(true);

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

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save signature.");
      }

      await loadSignatures();
      closeSaveSignatureModal();
      showSuccess(data.message || `Signature "${name}" saved successfully.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to save signature.");
    } finally {
      setSavingSignature(false);
    }
  }

  async function handleDeleteSignature(id: string) {
    try {
      const res = await fetch(`/api/admin/email/signatures/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to delete signature.");
      }

      if (selectedSignatureId === id) {
        const remaining = signatures.filter((item) => item.id !== id);
        setSelectedSignatureId(remaining[0]?.id || "");
      }

      await loadSignatures();
      showSuccess(data.message || "Signature deleted successfully.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to delete signature.");
    }
  }

  function applySignatureToBody(signature: SignatureItem) {
    if (sendProvider === "resend") {
      showError("Signatures are disabled when using Noreply (Resend).");
      return;
    }

    setSelectedSignatureId(signature.id);
    setShowHtmlPreview(true);
    showSuccess(
      `Signature "${signature.name}" selected and will appear at the bottom of the email.`
    );
  }

  function insertSelectedSignature() {
    if (sendProvider === "resend") {
      showError("Signatures are disabled when using Noreply (Resend).");
      return;
    }

    const nextSelectedSignature = signatures.find(
      (item) => item.id === selectedSignatureId
    );

    if (!nextSelectedSignature) {
      showError("Please select a signature first.");
      return;
    }

    applySignatureToBody(nextSelectedSignature);
  }

  async function handleSaveDraft() {
    setNotice(null);

    if (!form.to.trim() || !form.subject.trim()) {
      showError("Please add at least To and Subject before saving a draft.");
      return;
    }

    try {
      setSavingDraft(true);

      const cleanedBodyHtml = stripKnownSignaturesFromHtml(
        form.html || editor?.getHTML() || "",
        signatures
      );
      const cleanedBodyText = stripKnownSignaturesFromText(
        form.message || editor?.getText() || "",
        signatures
      );

      const { finalHtml, finalText } =
        sendProvider === "resend"
          ? {
              finalHtml: cleanedBodyHtml,
              finalText: cleanedBodyText,
            }
          : buildBodyWithSelectedSignature(
              cleanedBodyHtml,
              cleanedBodyText,
              selectedSignature,
              signatures
            );

      const formData = new FormData();
      formData.append("to", form.to);
      formData.append("cc", form.cc);
      formData.append("bcc", form.bcc);
      formData.append("subject", form.subject);
      formData.append("message", finalText);
      formData.append("html", finalHtml);
      formData.append("editorMode", editorMode);
      formData.append("signatureId", selectedSignatureId || "");
      formData.append("sendProvider", sendProvider);

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

      showSuccess(data.message || "Draft saved successfully.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to save draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (!canSend) {
      showError("Please fill in To, Subject, and the email content before sending.");
      return;
    }

    try {
      setSending(true);

      const cleanedBodyHtml = stripKnownSignaturesFromHtml(
        form.html || editor?.getHTML() || "",
        signatures
      );
      const cleanedBodyText = stripKnownSignaturesFromText(
        form.message || editor?.getText() || "",
        signatures
      );

      const { finalHtml, finalText } =
        sendProvider === "resend"
          ? {
              finalHtml: cleanedBodyHtml,
              finalText: cleanedBodyText,
            }
          : buildBodyWithSelectedSignature(
              cleanedBodyHtml,
              cleanedBodyText,
              selectedSignature,
              signatures
            );

      const formData = new FormData();
      formData.append("to", form.to);
      formData.append("cc", form.cc);
      formData.append("bcc", form.bcc);
      formData.append("subject", form.subject);
      formData.append("message", finalText);
      formData.append("html", finalHtml);
      formData.append("editorMode", editorMode);
      formData.append("signatureId", selectedSignatureId || "");
      formData.append("sendProvider", sendProvider);

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

      const successMessage = data.message || "Email sent successfully.";
      clearForm();
      setNotice({ type: "success", message: successMessage });
      await loadHistory();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  const showConnectGoogleButton =
    sendProvider === "google" &&
    notice?.type === "error" &&
    notice.message.toLowerCase().includes("google connection");

  const providerLabel =
    sendProvider === "resend"
      ? "Sending from noreply@burtonpride.co.uk with Resend"
      : "Sending with Google account connection";

  return (
    <div className="min-w-0 p-4 md:p-6 lg:p-8">
      <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: rgba(15, 23, 42, 0.35);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        .ProseMirror {
          color: #111827;
          background: #ffffff;
          caret-color: #111827;
        }

        .ProseMirror p,
        .ProseMirror li,
        .ProseMirror h1,
        .ProseMirror h2,
        .ProseMirror h3,
        .ProseMirror blockquote {
          margin: 0 0 0.75rem 0;
        }

        .ProseMirror h1 {
          font-size: 2rem;
          font-weight: 700;
          line-height: 1.2;
        }

        .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1.25;
        }

        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
        }

        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.75rem;
          margin: 1rem 0;
        }

        .ProseMirror a {
          color: #7c3aed;
          text-decoration: underline;
        }

        .ProseMirror blockquote {
          border-left: 3px solid #d1d5db;
          padding-left: 1rem;
          color: #4b5563;
        }
      `}</style>

      <EditorActionModal
        modal={modal}
        onClose={() => setModal(null)}
        onChange={(value) => {
          setModal((prev) => (prev ? { ...prev, value } : prev));
        }}
        onSubmit={submitModal}
      />

      <SaveTemplateModal
        state={saveTemplateModal}
        saving={savingTemplate}
        onClose={closeSaveTemplateModal}
        onChange={(next) =>
          setSaveTemplateModal((prev) => ({
            ...prev,
            ...next,
          }))
        }
        onSubmit={handleSaveTemplate}
      />

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_390px]">
        <section className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3">
              <Mail className="h-6 w-6 text-fuchsia-200" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                <Sparkles className="h-3.5 w-3.5" />
                Gmail-style email composer
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Send Email
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65 md:text-base">
                One rich editor, plus raw HTML mode when you want to type HTML directly.
              </p>
            </div>
          </div>

          <div className="mb-6 rounded-3xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-white">Send method</p>
              <p className="text-xs text-white/50">
                Switch between noreply sending with Resend or connected Google sending.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-2xl border border-white/10 bg-[#060b17] p-1">
                <button
                  type="button"
                  onClick={() => setSendProvider("resend")}
                  className={clsx(
                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                    sendProvider === "resend"
                      ? "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white"
                      : "text-white/65 hover:text-white"
                  )}
                >
                  Noreply (Resend)
                </button>

                <button
                  type="button"
                  onClick={() => setSendProvider("google")}
                  className={clsx(
                    "rounded-xl px-4 py-2 text-sm font-medium transition",
                    sendProvider === "google"
                      ? "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white"
                      : "text-white/65 hover:text-white"
                  )}
                >
                  Google
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/70">
                {providerLabel}
              </div>
            </div>

            {sendProvider === "resend" ? (
              <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                This mode does not need Gmail inbox connection. Emails will send using your Resend setup and noreply address.
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
                This mode uses your connected Google account for sending.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <NoticeBanner notice={notice} />

            {showConnectGoogleButton ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={connectGoogle}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                >
                  <Mail className="h-4 w-4" />
                  Connect Google Account
                </button>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSend} className="mt-6 space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <FieldLabel required>To</FieldLabel>
                </div>

                <Input
                  value={form.to}
                  onChange={(value) => updateField("to", value)}
                  placeholder="name@example.com"
                  type="email"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <FieldLabel>Saved template</FieldLabel>

                  <button
                    type="button"
                    onClick={openSaveTemplateModal}
                    className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Save new
                  </button>
                </div>

                <select
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    if (e.target.value) applyTemplate(e.target.value);
                  }}
                  value={selectedTemplateId}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
                >
                  <option value="" className="bg-slate-900 text-white">
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

                <p className="mt-2 text-xs text-white/45">
                  Choose a saved template or save the current email as a new one.
                </p>
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

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-white">Email signatures</p>
                <p className="text-xs text-white/50">
                  Save multiple signatures and use the one you want.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  value={selectedSignatureId}
                  onChange={(e) => setSelectedSignatureId(e.target.value)}
                  disabled={signaturesDisabled}
                  className={clsx(
                    "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
                    signaturesDisabled
                      ? "cursor-not-allowed border-white/5 bg-black/10 text-white/35"
                      : "border-white/10 bg-black/20 text-white focus:border-fuchsia-400/30 focus:bg-white/[0.04]"
                  )}
                >
                  <option value="" className="bg-slate-900 text-white">
                    {signaturesLoading ? "Loading signatures..." : "Pick a signature"}
                  </option>
                  {signatures.map((signature) => (
                    <option
                      key={signature.id}
                      value={signature.id}
                      className="bg-slate-900 text-white"
                    >
                      {signature.name}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={insertSelectedSignature}
                    disabled={signaturesDisabled}
                    className={clsx(
                      "inline-flex min-h-[46px] items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition",
                      signaturesDisabled
                        ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
                        : "border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.10]"
                    )}
                  >
                    <Signature className="h-4 w-4" />
                    Use signature
                  </button>

                  {selectedSignatureId && !signaturesDisabled ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteSignature(selectedSignatureId)}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>

              {signaturesDisabled ? (
                <p className="mt-3 text-xs text-amber-200/90">
                  Signatures are disabled when sending with Noreply (Resend).
                </p>
              ) : selectedSignatureId ? (
                <p className="mt-3 text-xs text-white/55">
                  Selected signature will appear once at the bottom of preview, draft and sent email.
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-white">Quick email presets</p>
                <p className="text-xs text-white/50">
                  Load a ready-made rich email layout.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {emailPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08]"
                  >
                    <div className="text-sm font-semibold text-white">{preset.name}</div>
                    <div className="mt-1 text-xs text-white/50">{preset.subject}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <FieldLabel required>Email body</FieldLabel>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
                    <button
                      type="button"
                      onClick={() => setEditorMode("rich")}
                      className={clsx(
                        "rounded-xl px-3 py-2 text-sm transition",
                        editorMode === "rich"
                          ? "bg-white/10 text-white"
                          : "text-white/60 hover:text-white"
                      )}
                    >
                      Rich editor
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

                  <button
                    type="button"
                    onClick={() => setShowHtmlPreview((prev) => !prev)}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
                  >
                    <Eye className="h-4 w-4" />
                    {showHtmlPreview ? "Hide preview" : "Show preview"}
                  </button>

                  <button
                    type="button"
                    onClick={openSaveTemplateModal}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                  >
                    <Save className="h-4 w-4" />
                    Save as template
                  </button>
                </div>
              </div>

              {editorMode === "rich" ? (
                <>
                  <RichEditorToolbar
                    editor={editor}
                    openLinkModal={openLinkModal}
                    openImageModal={openImageModal}
                  />

                  <div className="mt-4">
                    <EditorContent editor={editor} />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <textarea
                    value={form.html}
                    onChange={(e) => handleRawHtmlChange(e.target.value)}
                    placeholder="<h1>Hello</h1><p>Your HTML email here...</p>"
                    rows={16}
                    className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-400/30"
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={applyRawHtmlToEditor}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white transition hover:bg-white/[0.10]"
                    >
                      <Wand2 className="h-4 w-4" />
                      Apply HTML to editor
                    </button>
                  </div>
                </div>
              )}

              {showHtmlPreview ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-600">
                    Email preview
                  </div>
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    {sendProvider === "resend"
                      ? "From: noreply@burtonpride.co.uk via Resend"
                      : "From: connected Google account"}
                  </div>
                  <div className="max-h-[700px] overflow-auto p-4 text-slate-900">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: previewHtml || "<p>No email content yet.</p>",
                      }}
                    />
                  </div>
                </div>
              ) : null}
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
                      const previewUrl = filePreviews[index];
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

                          {isImage && previewUrl ? (
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
                    {sendProvider === "resend" ? "Send with noreply" : "Send email"}
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
                onClick={openSaveTemplateModal}
                disabled={savingTemplate || !canSaveTemplate}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-5 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Save as template
              </button>

              <button
                type="button"
                onClick={openSaveSignatureModal}
                disabled={signaturesDisabled}
                className={clsx(
                  "inline-flex min-h-[52px] items-center gap-2 rounded-2xl border px-5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                  signaturesDisabled
                    ? "border-white/10 bg-white/[0.03] text-white/35"
                    : "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20"
                )}
              >
                <Signature className="h-4 w-4" />
                Save signature
              </button>

              <button
                type="button"
                disabled={sending || savingDraft}
                onClick={clearForm}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 text-sm font-medium text-white transition hover:bg-white/[0.10] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear form
              </button>

              {showConnectGoogleButton ? (
                <button
                  type="button"
                  onClick={connectGoogle}
                  className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-5 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                >
                  <Mail className="h-4 w-4" />
                  Connect Google
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <aside className="space-y-6">
          <SectionCard
            title="Send mode"
            icon={<Mail className="h-5 w-5 text-fuchsia-200" />}
          >
            <div className="space-y-3">
              <div
                className={clsx(
                  "rounded-2xl border px-4 py-3 text-sm",
                  sendProvider === "resend"
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-black/20 text-white/70"
                )}
              >
                <div className="font-semibold">Noreply (Resend)</div>
                <div className="mt-1 text-xs opacity-80">
                  Sends from noreply@burtonpride.co.uk and does not need inbox connection.
                </div>
              </div>

              <div
                className={clsx(
                  "rounded-2xl border px-4 py-3 text-sm",
                  sendProvider === "google"
                    ? "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100"
                    : "border-white/10 bg-black/20 text-white/70"
                )}
              >
                <div className="font-semibold">Google</div>
                <div className="mt-1 text-xs opacity-80">
                  Uses connected Google account sending.
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Preset email layouts"
            icon={<Wand2 className="h-5 w-5 text-fuchsia-200" />}
          >
            <div className="space-y-3">
              {emailPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                >
                  <div className="text-sm font-semibold text-white">
                    {preset.name}
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    {preset.subject}
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Template picker"
            icon={<Sparkles className="h-5 w-5 text-fuchsia-200" />}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-white/55">
                Saved templates you can reuse.
              </p>

              <button
                type="button"
                onClick={openSaveTemplateModal}
                className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
              >
                <Plus className="h-3.5 w-3.5" />
                New template
              </button>
            </div>

            <div className="space-y-3">
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
                    className={clsx(
                      "block w-full rounded-2xl border px-4 py-3 text-left transition",
                      selectedTemplateId === template.id
                        ? "border-fuchsia-400/30 bg-fuchsia-500/10"
                        : "border-white/10 bg-black/20 hover:bg-white/[0.06]"
                    )}
                  >
                    <div className="text-sm font-semibold text-white">
                      {template.name}
                    </div>
                    <div className="mt-1 text-xs text-white/50">
                      {template.subject || "No subject"}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                  No templates found.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Signature picker"
            icon={<Signature className="h-5 w-5 text-fuchsia-200" />}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-white/55">
                Save and reuse multiple signatures.
              </p>

              <button
                type="button"
                onClick={openSaveSignatureModal}
                disabled={signaturesDisabled}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  signaturesDisabled
                    ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
                    : "border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                New signature
              </button>
            </div>

            <div className="space-y-3">
              {signaturesLoading ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                  Loading signatures...
                </div>
              ) : signatures.length > 0 ? (
                signatures.map((signature) => (
                  <div
                    key={signature.id}
                    className={clsx(
                      "rounded-2xl border px-4 py-3",
                      selectedSignatureId === signature.id
                        ? "border-fuchsia-400/30 bg-fuchsia-500/10"
                        : "border-white/10 bg-black/20"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (signaturesDisabled) return;
                        setSelectedSignatureId(signature.id);
                      }}
                      disabled={signaturesDisabled}
                      className={clsx(
                        "block w-full text-left",
                        signaturesDisabled ? "cursor-not-allowed opacity-40" : ""
                      )}
                    >
                      <div className="text-sm font-semibold text-white">
                        {signature.name}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {signature.is_default ? "Default signature" : "Saved signature"}
                      </div>
                    </button>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => applySignatureToBody(signature)}
                        disabled={signaturesDisabled}
                        className={clsx(
                          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition",
                          signaturesDisabled
                            ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
                            : "border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.10]"
                        )}
                      >
                        <Signature className="h-3.5 w-3.5" />
                        Use
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSignature(signature.id)}
                        disabled={signaturesDisabled}
                        className={clsx(
                          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition",
                          signaturesDisabled
                            ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
                            : "border-rose-400/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/60">
                  No signatures found.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Sent email history"
            icon={<History className="h-5 w-5 text-fuchsia-200" />}
          >
            <div className="space-y-3">
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
          </SectionCard>

          <SectionCard
            title="Editor features"
            icon={<FileText className="h-5 w-5 text-fuchsia-200" />}
          >
            <div className="grid gap-3">
              {[
                "Resend noreply send mode",
                "Google send mode",
                "Rich editor buttons work on empty body",
                "Raw HTML mode included",
                "Custom modal for links and images",
                "Presets and saved templates",
                "Multiple reusable signatures",
                "Selected signature stays separate from body",
                "No duplicated signatures",
                "Preview before sending",
                "Draft save and attachments",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75"
                >
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}