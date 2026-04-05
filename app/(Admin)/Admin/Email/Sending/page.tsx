"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const TEST_EMAIL = "burtonpridetest@gmail.com";

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
        <ToolbarButton
          title="Undo"
          onClick={() => run((ed) => ed.chain().focus().undo().run())}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          title="Redo"
          onClick={() => run((ed) => ed.chain().focus().redo().run())}
        >
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

        <ToolbarButton
          title="Add image"
          onClick={() => run(() => openImageModal())}
        >
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
              ed
                .chain()
                .focus()
                .unsetAllMarks()
                .clearNodes()
                .setColor("#111827")
                .run();
            })
          }
        >
          <span className="text-xs font-semibold">Clear</span>
        </ToolbarButton>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["#ffffff", "#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa"].map(
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
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [editorMode, setEditorMode] = useState<"rich" | "html">("rich");

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [editorReady, setEditorReady] = useState(false);

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
    onCreate: ({ editor }) => {
      setEditorReady(true);
      setForm((prev) => ({
        ...prev,
        html: editor.getHTML(),
        message: editor.getText(),
      }));
    },
    onUpdate: ({ editor }) => {
      setForm((prev) => ({
        ...prev,
        html: editor.getHTML(),
        message: editor.getText(),
      }));
    },
  });

  const canSend = useMemo(() => {
    const bodySource = form.html;
    return (
      form.to.trim().length > 0 &&
      form.subject.trim().length > 0 &&
      bodySource.replace(/<[^>]+>/g, "").trim().length > 0
    );
  }, [form.to, form.subject, form.html]);

  useEffect(() => {
    loadTemplates();
    loadHistory();
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
    editor.commands.setContent(nextHtml, { emitUpdate: true });
  }

  function showSuccess(message: string) {
    setNotice({ type: "success", message });
  }

  function showError(message: string) {
    setNotice({ type: "error", message });
  }

  function fillTestEmail() {
    const html = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; background:#f4f4f7; padding:24px;">
  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; border:1px solid #e5e7eb; padding:32px 24px;">
    <h2 style="margin: 0 0 16px;">Test Email from Burton Pride Admin Portal</h2>
    <p>Hello,</p>
    <p>This is a test email sent from the Burton Pride admin portal.</p>
    <p>If you have received this email, the email system is working correctly.</p>
    <p>Kind regards,<br />Burton Pride C.I.C</p>
  </div>
</div>`;

    setForm((prev) => ({
      ...prev,
      to: TEST_EMAIL,
      subject: prev.subject.trim() || "Test Email from Burton Pride Admin Portal",
      html,
      message: "Test Email from Burton Pride Admin Portal",
    }));

    syncEditorContent(html);
    showSuccess(`Test email details filled in for ${TEST_EMAIL}`);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (editor) editor.commands.clearContent(true);
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

    const nextHtml = template.html || `<p>${template.message || ""}</p>`;

    setForm((prev) => ({
      ...prev,
      subject: template.subject || prev.subject,
      message: template.message || prev.message,
      html: nextHtml,
    }));

    syncEditorContent(nextHtml);
    setEditorMode("rich");
    showSuccess(`Template "${template.name}" applied.`);
  }

  function applyPreset(presetId: string) {
    const preset = emailPresets.find((item) => item.id === presetId);
    if (!preset) return;

    setForm((prev) => ({
      ...prev,
      subject: prev.subject.trim() || preset.subject,
      html: preset.html,
      message: htmlToPlainText(preset.html),
    }));

    syncEditorContent(preset.html);
    setShowHtmlPreview(true);
    setEditorMode("rich");
    showSuccess(`Preset "${preset.name}" loaded.`);
  }

  function openLinkModal() {
    if (!editor) return;
    const previousUrl = (editor.getAttributes("link").href as string) || "https://";
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
    setForm((prev) => ({
      ...prev,
      html: value,
      message: htmlToPlainText(value),
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

  async function handleSaveDraft() {
    setNotice(null);

    if (!form.to.trim() || !form.subject.trim()) {
      showError("Please add at least To and Subject before saving a draft.");
      return;
    }

    try {
      setSavingDraft(true);

      const formData = new FormData();
      formData.append("to", form.to);
      formData.append("cc", form.cc);
      formData.append("bcc", form.bcc);
      formData.append("subject", form.subject);
      formData.append("message", form.message || editor?.getText() || "");
      formData.append("html", form.html || editor?.getHTML() || "");
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

      const formData = new FormData();
      formData.append("to", form.to);
      formData.append("cc", form.cc);
      formData.append("bcc", form.bcc);
      formData.append("subject", form.subject);
      formData.append("message", form.message || editor?.getText() || "");
      formData.append("html", form.html || editor?.getHTML() || "");
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
    notice?.type === "error" &&
    notice.message.toLowerCase().includes("google connection");

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_390px]">
        <section className="rounded-3xl border border-white/10 bg-[#0a1022]/80 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3">
              <Mail className="h-6 w-6 text-fuchsia-200" />
            </div>

            <div>
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
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <FieldLabel required>To</FieldLabel>

                  <button
                    type="button"
                    onClick={fillTestEmail}
                    className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Autofill test email
                  </button>
                </div>

                <Input
                  value={form.to}
                  onChange={(value) => updateField("to", value)}
                  placeholder="name@example.com"
                  type="email"
                />

                <p className="mt-2 text-xs text-white/45">
                  Test address: {TEST_EMAIL}
                </p>
              </div>

              <div>
                <FieldLabel>Saved template</FieldLabel>
                <select
                  onChange={(e) => {
                    if (e.target.value) applyTemplate(e.target.value);
                  }}
                  value=""
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
                    {editorReady ? (
                      <EditorContent editor={editor} />
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                        Loading editor...
                      </div>
                    )}
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
                  <div className="max-h-[700px] overflow-auto p-4 text-slate-900">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: form.html || "<p>No email content yet.</p>",
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
                "Rich editor buttons work on empty body",
                "Raw HTML mode included",
                "Custom modal for links and images",
                "Presets and saved templates",
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