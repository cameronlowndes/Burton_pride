"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
  Link2,
  Reply,
  Send,
  X,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Paperclip,
  Download,
  Eye,
  Upload,
  Trash2,
} from "lucide-react";

type InboxItem = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  unread: boolean;
  labelIds: string[];
};

type MessageAttachment = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
  inline: boolean;
  contentId: string;
};

type MessageDetail = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  snippet: string;
  html: string;
  text: string;
  labelIds: string[];
  attachments?: MessageAttachment[];
};

type Notice =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

type ReplyForm = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type EditorDialogMode = "link" | "image" | null;

const GMAIL_RECONNECT_REGEX =
  /No Gmail account connected|Missing Gmail refresh token|Failed to refresh Gmail token/i;

export default function InboxClient() {
  const [messages, setMessages] = useState<InboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(
    null
  );
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const [replyOpen, setReplyOpen] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [replyForm, setReplyForm] = useState<ReplyForm>({
    to: "",
    subject: "",
    html: "",
    text: "",
  });

  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const [editorDialogMode, setEditorDialogMode] =
    useState<EditorDialogMode>(null);
  const [editorDialogValue, setEditorDialogValue] = useState("");
  const [editorDialogError, setEditorDialogError] = useState("");

  const needsReconnect =
    notice?.type === "error" && GMAIL_RECONNECT_REGEX.test(notice.message);

  async function loadInbox(search = "") {
    try {
      setLoadingList(true);
      setNotice(null);

      const res = await fetch(
        `/api/admin/email/inbox?q=${encodeURIComponent(
          search
        )}&maxResults=25`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load inbox.");
      }

      const nextMessages = Array.isArray(data.messages) ? data.messages : [];
      setMessages(nextMessages);

      if (nextMessages.length > 0) {
        const keepCurrent =
          nextMessages.find((m: InboxItem) => m.id === selectedId)?.id || "";
        const nextSelectedId = keepCurrent || nextMessages[0].id;
        setSelectedId(nextSelectedId);
      } else {
        setSelectedId("");
        setSelectedMessage(null);
        setReplyOpen(false);
      }
    } catch (error) {
      setMessages([]);
      setSelectedId("");
      setSelectedMessage(null);
      setReplyOpen(false);
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to load inbox.",
      });
    } finally {
      setLoadingList(false);
    }
  }

  async function loadMessage(id: string) {
    try {
      setLoadingMessage(true);
      setReplyOpen(false);
      setNotice((current) =>
        current?.type === "error" && !needsReconnect ? null : current
      );

      const res = await fetch(`/api/admin/email/message/${id}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load email.");
      }

      setSelectedMessage(data.message);

      await fetch(`/api/admin/email/message/${id}/read`, {
        method: "POST",
      }).catch(() => null);

      setMessages((current) =>
        current.map((item) =>
          item.id === id ? { ...item, unread: false } : item
        )
      );
    } catch (error) {
      setSelectedMessage(null);
      setReplyOpen(false);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load email.",
      });
    } finally {
      setLoadingMessage(false);
    }
  }

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await loadInbox(query);
      setNotice({ type: "success", message: "Inbox refreshed." });
    } finally {
      setRefreshing(false);
    }
  }

  function getReplyRecipient(message: MessageDetail) {
    const fromEmail = extractEmailAddress(message.from || "");
    const toEmail = extractEmailAddress(message.to || "");

    const ownAddresses = [
      "cameronlowndes@burtonpride.co.uk",
      "burtonpridetest@gmail.com",
      "info@burtonpride.co.uk",
      "noreply@burtonpride.co.uk",
    ];

    const looksLikeOwnAddress = (email: string) =>
      ownAddresses.includes(email.toLowerCase().trim());

    if (fromEmail && !looksLikeOwnAddress(fromEmail)) return fromEmail;
    if (toEmail && !looksLikeOwnAddress(toEmail)) return toEmail;

    return fromEmail || toEmail || "";
  }

  function openReply() {
    if (!selectedMessage) return;

    const subject = selectedMessage.subject || "";
    const replySubject = subject.startsWith("Re:")
      ? subject
      : `Re: ${subject || "(No subject)"}`;

    setReplyForm({
      to: getReplyRecipient(selectedMessage),
      subject: replySubject,
      html: "",
      text: "",
    });

    setReplyFiles([]);
    setReplyOpen(true);

    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
        editorRef.current.focus();
      }
    }, 50);
  }

  function closeReply() {
    setReplyOpen(false);
    setReplyForm({
      to: "",
      subject: "",
      html: "",
      text: "",
    });
    setReplyFiles([]);
    setEditorDialogMode(null);
    setEditorDialogValue("");
    setEditorDialogError("");

    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  }

  function syncEditorState() {
    const html = editorRef.current?.innerHTML || "";
    const text = editorRef.current?.innerText || "";
    setReplyForm((current) => ({
      ...current,
      html,
      text,
    }));
  }

  function focusEditor() {
    editorRef.current?.focus();
  }

  function exec(command: string, value?: string) {
    focusEditor();
    document.execCommand(command, false, value);
    syncEditorState();
  }

  function setBlock(tag: "h1" | "h2" | "p") {
    focusEditor();
    document.execCommand("formatBlock", false, tag);
    syncEditorState();
  }

  function openEditorDialog(mode: EditorDialogMode) {
    setEditorDialogMode(mode);
    setEditorDialogValue("");
    setEditorDialogError("");
  }

  function closeEditorDialog() {
    setEditorDialogMode(null);
    setEditorDialogValue("");
    setEditorDialogError("");
  }

  function confirmEditorDialog() {
    const raw = editorDialogValue.trim();

    if (!raw) {
      setEditorDialogError(
        editorDialogMode === "link"
          ? "Please enter a link."
          : "Please enter an image URL."
      );
      return;
    }

    const normalized =
      raw.startsWith("http://") ||
      raw.startsWith("https://") ||
      raw.startsWith("mailto:") ||
      raw.startsWith("tel:")
        ? raw
        : `https://${raw}`;

    try {
      if (
        editorDialogMode === "link" &&
        !/^https?:\/\/|^mailto:|^tel:/i.test(normalized)
      ) {
        setEditorDialogError("Please enter a valid link.");
        return;
      }

      if (editorDialogMode === "image" && !/^https?:\/\//i.test(normalized)) {
        setEditorDialogError("Please enter a valid image URL.");
        return;
      }

      focusEditor();

      if (editorDialogMode === "link") {
        document.execCommand("createLink", false, normalized);
      }

      if (editorDialogMode === "image") {
        document.execCommand("insertImage", false, normalized);
      }

      syncEditorState();
      closeEditorDialog();
    } catch {
      setEditorDialogError("Could not insert that value.");
    }
  }

  function triggerFilePicker() {
    fileInputRef.current?.click();
  }

  function handleReplyFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files || []);
    if (!incoming.length) return;

    const maxSize = 20 * 1024 * 1024;
    const validFiles: File[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (file.size > maxSize) {
        rejected.push(`${file.name} is bigger than 20MB.`);
        continue;
      }
      validFiles.push(file);
    }

    setReplyFiles((current) => [...current, ...validFiles]);

    if (rejected.length > 0) {
      setNotice({
        type: "error",
        message: rejected.join(" "),
      });
    }

    event.target.value = "";
  }

  function removeReplyFile(index: number) {
    setReplyFiles((current) => current.filter((_, i) => i !== index));
  }

  async function sendReply() {
    if (!selectedMessage) return;

    try {
      setReplySending(true);

      const htmlMessage = sanitizeReplyHtml(replyForm.html);
      const plainTextMessage =
        replyForm.text.trim() || stripHtml(htmlMessage).trim();

      const formData = new FormData();
      formData.append("to", replyForm.to);
      formData.append("subject", replyForm.subject);
      formData.append("message", plainTextMessage);
      formData.append("htmlMessage", htmlMessage);
      formData.append("threadId", selectedMessage.threadId || "");
      formData.append("replyToMessageId", selectedMessage.id || "");
      formData.append("originalFrom", selectedMessage.from || "");
      formData.append("originalDate", selectedMessage.date || "");
      formData.append(
        "originalBody",
        selectedMessage.text || selectedMessage.snippet || ""
      );

      replyFiles.forEach((file) => {
        formData.append("attachments", file);
      });

      const res = await fetch("/api/admin/email/reply", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to send reply.");
      }

      closeReply();
      setNotice({
        type: "success",
        message:
          data.message ||
          (replyFiles.length > 0
            ? "Reply with attachments sent successfully."
            : "Reply sent successfully."),
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to send reply.",
      });
    } finally {
      setReplySending(false);
    }
  }

  useEffect(() => {
    loadInbox();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadMessage(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!notice) return;

    if (notice.type === "error" && GMAIL_RECONNECT_REGEX.test(notice.message)) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedPreview = useMemo(() => {
    if (!selectedMessage) return "";
    return selectedMessage.text || selectedMessage.snippet || "";
  }, [selectedMessage]);

  return (
    <div className="min-h-screen bg-transparent text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
              <p className="mt-1 text-sm text-white/70">
                View your Google email inbox inside the admin portal.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setQuery(searchInput);
                  loadInbox(searchInput);
                }}
                className="group flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 shadow-inner shadow-white/5 transition hover:border-white/20 hover:bg-black/25"
              >
                <Search className="h-4 w-4 text-white/60" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search inbox..."
                  className="w-56 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                />
              </form>

              <button
                onClick={handleRefresh}
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium shadow-[0_8px_30px_rgba(0,0,0,0.15)] transition hover:scale-[1.01] hover:bg-white/15 active:scale-[0.99]"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </button>
            </div>
          </div>
        </div>

        {notice && (
          <div
            className={`mb-4 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:flex-row sm:items-center sm:justify-between ${
              notice.type === "success"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-red-400/30 bg-red-500/10 text-red-200"
            }`}
          >
            <span>{notice.message}</span>

            {needsReconnect ? (
              <a
                href="/api/admin/google/connect"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/15"
              >
                <Link2 className="h-4 w-4" />
                Reconnect Google
              </a>
            ) : null}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <div className="border-b border-white/10 px-4 py-4">
              <h2 className="text-sm font-semibold tracking-wide text-white/85">
                Messages
              </h2>
            </div>

            <div className="max-h-[75vh] overflow-y-auto">
              {loadingList ? (
                <div className="flex items-center justify-center py-16 text-white/60">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-white/50">
                  <p>No emails found.</p>
                </div>
              ) : (
                messages.map((message) => {
                  const active = selectedId === message.id;

                  return (
                    <button
                      key={message.id}
                      onClick={() => setSelectedId(message.id)}
                      className={`w-full border-b border-white/5 px-4 py-4 text-left transition ${
                        active
                          ? "bg-white/10 shadow-inner shadow-white/5"
                          : "hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          {message.unread ? (
                            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
                          ) : (
                            <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                          )}
                          <span
                            className={`truncate text-sm ${
                              message.unread
                                ? "font-semibold text-white"
                                : "text-white/80"
                            }`}
                          >
                            {message.from || "Unknown sender"}
                          </span>
                        </div>

                        <span className="shrink-0 text-[11px] text-white/40">
                          {formatDate(message.date)}
                        </span>
                      </div>

                      <div
                        className={`truncate text-sm ${
                          message.unread
                            ? "font-medium text-white"
                            : "text-white/75"
                        }`}
                      >
                        {message.subject || "(No subject)"}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">
                        {message.snippet}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <div className="border-b border-white/10 px-5 py-4">
              {selectedMessage ? (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-[1.75rem] font-semibold tracking-tight text-white">
                      {selectedMessage.subject || "(No subject)"}
                    </h2>

                    <div className="mt-3 space-y-1.5 text-sm text-white/65">
                      <p>
                        <span className="text-white/40">From:</span>{" "}
                        {selectedMessage.from || "-"}
                      </p>
                      <p>
                        <span className="text-white/40">To:</span>{" "}
                        {selectedMessage.to || "-"}
                      </p>
                      {selectedMessage.cc ? (
                        <p>
                          <span className="text-white/40">CC:</span>{" "}
                          {selectedMessage.cc}
                        </p>
                      ) : null}
                      <p>
                        <span className="text-white/40">Date:</span>{" "}
                        {formatDateLong(selectedMessage.date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={openReply}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium shadow-[0_8px_30px_rgba(0,0,0,0.16)] transition hover:scale-[1.01] hover:bg-white/15 active:scale-[0.99]"
                    >
                      <Reply className="h-4 w-4" />
                      Reply
                    </button>
                  </div>
                </div>
              ) : (
                <h2 className="text-lg font-semibold">Select an email</h2>
              )}
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
              {loadingMessage ? (
                <div className="flex items-center justify-center py-16 text-white/60">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : !selectedMessage ? (
                <div className="py-16 text-center text-sm text-white/50">
                  Choose a message from the inbox.
                </div>
              ) : (
                <>
                  {selectedMessage.attachments &&
                  selectedMessage.attachments.length > 0 ? (
                    <div className="mb-5 rounded-[24px] border border-white/8 bg-black/10 p-4 shadow-inner shadow-white/5">
                      <div className="mb-3 flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-pink-300" />
                        <h3 className="text-sm font-semibold text-white">
                          Attachments ({selectedMessage.attachments.length})
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {selectedMessage.attachments.map((attachment) => {
                          const href = `/api/admin/email/message/${selectedMessage.id}/attachment?attachmentId=${encodeURIComponent(
                            attachment.attachmentId
                          )}&filename=${encodeURIComponent(
                            attachment.filename || "attachment"
                          )}`;

                          return (
                            <div
                              key={attachment.attachmentId}
                              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-white">
                                  {attachment.filename || "Unnamed attachment"}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
                                  <span>{attachment.mimeType}</span>
                                  <span>{formatBytes(attachment.size)}</span>
                                  {attachment.inline ? (
                                    <span className="text-emerald-300/80">
                                      Inline
                                    </span>
                                  ) : (
                                    <span className="text-white/40">File</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-wrap gap-2">
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                                >
                                  <Eye className="h-4 w-4" />
                                  Open
                                </a>

                                <a
                                  href={`${href}&download=1`}
                                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                                >
                                  <Download className="h-4 w-4" />
                                  Download
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[24px] border border-white/8 bg-black/10 p-4 shadow-inner shadow-white/5">
                    <div
                      className="gmail-message-body max-w-none text-sm leading-7 text-white/85"
                      dangerouslySetInnerHTML={{
                        __html: getRenderableMessageHtml(selectedMessage),
                      }}
                    />
                  </div>

                  {replyOpen ? (
                    <div className="mt-6 rounded-[28px] border border-white/10 bg-[#24154a] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            Rich editor toolbar
                          </h3>
                          <p className="mt-1 text-sm text-white/45">
                            You can click buttons even before typing, then start
                            writing.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={closeReply}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium transition hover:bg-white/15"
                        >
                          <X className="h-4 w-4" />
                          Close
                        </button>
                      </div>

                      <div className="mb-4 rounded-[28px] border border-white/10 bg-[#221146] p-4">
                        <div className="flex flex-wrap gap-2">
                          <EditorButton onClick={() => exec("undo")}>
                            <Undo2 className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => exec("redo")}>
                            <Redo2 className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => exec("bold")}>
                            <Bold className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => exec("italic")}>
                            <Italic className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => exec("underline")}>
                            <UnderlineIcon className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => setBlock("h1")}>
                            H1
                          </EditorButton>
                          <EditorButton onClick={() => setBlock("h2")}>
                            H2
                          </EditorButton>
                          <EditorButton
                            active
                            onClick={() => exec("foreColor", "#f9fafb")}
                          >
                            <Type className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => exec("insertUnorderedList")}>
                            <List className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => exec("insertOrderedList")}>
                            <ListOrdered className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => openEditorDialog("link")}>
                            <Link2 className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => openEditorDialog("image")}>
                            <ImageIcon className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => exec("justifyLeft")}>
                            <AlignLeft className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => exec("justifyCenter")}>
                            <AlignCenter className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => exec("justifyRight")}>
                            <AlignRight className="h-4 w-4" />
                          </EditorButton>
                          <EditorButton onClick={() => exec("removeFormat")}>
                            Clear
                          </EditorButton>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          {[
                            "#ffffff",
                            "#ff4d6d",
                            "#ffb703",
                            "#10b981",
                            "#38bdf8",
                            "#a78bfa",
                          ].map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => exec("foreColor", color)}
                              className="h-9 w-9 rounded-full border border-white/10 shadow"
                              style={{ backgroundColor: color }}
                              title={`Text ${color}`}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => exec("foreColor", "#000000")}
                            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white"
                          >
                            Black
                          </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          {[
                            { label: "HL", color: "#f5e66d" },
                            { label: "HL", color: "#f6b26b" },
                            { label: "HL", color: "#7ee2a8" },
                            { label: "HL", color: "#8ab4f8" },
                            { label: "HL", color: "#f4a6d7" },
                          ].map((item, index) => (
                            <button
                              key={`${item.color}-${index}`}
                              type="button"
                              onClick={() => exec("hiliteColor", item.color)}
                              className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-900"
                              style={{ backgroundColor: item.color }}
                            >
                              {item.label}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => exec("hiliteColor", "transparent")}
                            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80"
                          >
                            No HL
                          </button>
                        </div>
                      </div>

                      <div className="mb-4 space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/75">
                            To
                          </label>
                          <input
                            type="text"
                            value={replyForm.to}
                            onChange={(e) =>
                              setReplyForm((current) => ({
                                ...current,
                                to: e.target.value,
                              }))
                            }
                            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-pink-300/40 focus:bg-white/15"
                            placeholder="Recipient email"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/75">
                            Subject
                          </label>
                          <input
                            type="text"
                            value={replyForm.subject}
                            onChange={(e) =>
                              setReplyForm((current) => ({
                                ...current,
                                subject: e.target.value,
                              }))
                            }
                            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-pink-300/40 focus:bg-white/15"
                            placeholder="Reply subject"
                          />
                        </div>

                        <div>
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              multiple
                              onChange={handleReplyFilesChange}
                              className="hidden"
                            />

                            <button
                              type="button"
                              onClick={triggerFilePicker}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                            >
                              <Upload className="h-4 w-4" />
                              Add attachment
                            </button>

                            {replyFiles.length > 0 ? (
                              <span className="text-xs text-white/55">
                                {replyFiles.length} file
                                {replyFiles.length === 1 ? "" : "s"} ready
                              </span>
                            ) : null}
                          </div>

                          {replyFiles.length > 0 ? (
                            <div className="mb-4 space-y-2 rounded-2xl border border-white/10 bg-black/10 p-3">
                              {replyFiles.map((file, index) => (
                                <div
                                  key={`${file.name}-${file.size}-${index}`}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-white">
                                      {file.name}
                                    </div>
                                    <div className="text-xs text-white/50">
                                      {formatBytes(file.size)}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeReplyFile(index)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white/80 transition hover:bg-red-500/20 hover:text-white"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={syncEditorState}
                            className="min-h-[320px] w-full rounded-[22px] border border-white/10 bg-white px-4 py-4 text-base leading-7 text-slate-900 outline-none"
                            style={{ whiteSpace: "pre-wrap" }}
                            data-placeholder="Write your email here..."
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                        <button
                          type="button"
                          onClick={closeReply}
                          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/15"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={sendReply}
                          disabled={
                            replySending ||
                            !replyForm.to.trim() ||
                            !replyForm.subject.trim() ||
                            !replyForm.text.trim()
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/90 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {replySending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          {replySending ? "Sending..." : "Send reply"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {editorDialogMode ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#25124b] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {editorDialogMode === "link" ? "Insert link" : "Insert image"}
                </h3>
                <p className="mt-1 text-sm text-white/50">
                  {editorDialogMode === "link"
                    ? "Paste the website address you want to insert."
                    : "Paste the direct image URL you want to insert."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditorDialog}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <input
                autoFocus
                value={editorDialogValue}
                onChange={(e) => {
                  setEditorDialogValue(e.target.value);
                  if (editorDialogError) setEditorDialogError("");
                }}
                placeholder={
                  editorDialogMode === "link"
                    ? "https://example.com"
                    : "https://example.com/image.jpg"
                }
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-pink-300/40 focus:bg-white/15"
              />
              {editorDialogError ? (
                <p className="mt-2 text-sm text-red-300">{editorDialogError}</p>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeEditorDialog}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEditorDialog}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white"
              >
                {editorDialogMode === "link" ? (
                  <Link2 className="h-4 w-4" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                Insert
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: rgba(15, 23, 42, 0.35);
          pointer-events: none;
        }

        .gmail-message-body {
          word-break: break-word;
        }

        .gmail-message-body a {
          color: #f9a8d4;
          text-decoration: underline;
          word-break: break-all;
        }

        .gmail-message-body a:hover {
          color: #fbcfe8;
        }

        .gmail-message-body p {
          margin: 0 0 1rem 0;
          color: rgba(255, 255, 255, 0.85);
        }

        .gmail-message-body ul,
        .gmail-message-body ol {
          margin: 0 0 1rem 1.25rem;
          padding-left: 1rem;
        }

        .gmail-message-body li {
          margin: 0.25rem 0;
          color: rgba(255, 255, 255, 0.85);
        }

        .gmail-message-body strong {
          color: white;
        }

        .gmail-message-body img {
          max-width: 100%;
          height: auto;
          border-radius: 14px;
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .gmail-message-body blockquote {
          margin: 1rem 0;
          padding-left: 1rem;
          border-left: 3px solid rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.65);
        }

        .gmail-message-body pre {
          white-space: pre-wrap;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 1rem;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}

function EditorButton({
  children,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-fuchsia-400/40 bg-fuchsia-500/20 text-white"
          : "border-white/10 bg-white/5 text-white/90 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function extractEmailAddress(value: string) {
  if (!value) return "";
  const match = value.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  return value.trim();
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeReplyHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function getRenderableMessageHtml(message: MessageDetail) {
  const safeHtml = sanitizeIncomingHtml(message.html || "");

  if (safeHtml.trim()) {
    return safeHtml;
  }

  const fallbackText = message.text || message.snippet || "";

  if (!fallbackText.trim()) {
    return `<p>No message content found.</p>`;
  }

  return textToLinkedHtml(fallbackText);
}

function sanitizeIncomingHtml(html: string) {
  if (!html) return "";

  let cleaned = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\sjavascript:/gi, "")
    .replace(/href=["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src=["']javascript:[^"']*["']/gi, "");

  cleaned = cleaned.replace(
    /<a\b([^>]*)>/gi,
    (_match, attrs) => {
      let nextAttrs = attrs || "";

      if (!/\btarget=/i.test(nextAttrs)) {
        nextAttrs += ` target="_blank"`;
      }

      if (!/\brel=/i.test(nextAttrs)) {
        nextAttrs += ` rel="noreferrer noopener"`;
      }

      return `<a${nextAttrs}>`;
    }
  );

  const hasRealText = stripHtml(cleaned).trim().length > 0;
  if (hasRealText) {
    return cleaned;
  }

  return "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textToLinkedHtml(text: string) {
  const escaped = escapeHtml(text);

  const linked = escaped.replace(
    /((https?:\/\/|www\.)[^\s<]+)/gi,
    (match) => {
      const href = match.startsWith("www.")
        ? `https://${match}`
        : match;

      return `<a href="${href}" target="_blank" rel="noreferrer noopener">${match}</a>`;
    }
  );

  return linked
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatDateLong(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 B";

  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    sizes.length - 1
  );

  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}