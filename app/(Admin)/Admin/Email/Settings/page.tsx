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
  signatureHtml: string;
  signatureText: string;
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

const initialSettings: EmailSettings = {
  senderName: "",
  senderEmail: "",
  replyTo: "",
  defaultCc: "",
  defaultBcc: "",
  signatureHtml: "",
  signatureText: "",
  testEmail: "",
  googleConnected: false,
  googleEmail: "",
};

function clsx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettings>(initialSettings);
  const [originalSettings, setOriginalSettings] =
    useState<EmailSettings>(initialSettings);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [refreshingGoogle, setRefreshingGoogle] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
          signatureHtml: settings.signatureHtml,
          signatureText: settings.signatureText,
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
                  Manage sender details, signature, default email behaviour,
                  Google connection, and test delivery settings.
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
              title="Email signature"
              description="Set the signature used for outgoing emails. You can store both HTML and plain text versions."
              icon={<Signature className="h-5 w-5 text-fuchsia-200" />}
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <FieldLabel>Signature HTML</FieldLabel>
                  <TextArea
                    value={settings.signatureHtml}
                    onChange={(value) => updateField("signatureHtml", value)}
                    placeholder="<p>Kind regards,<br /><strong>Your name</strong></p>"
                    rows={10}
                  />
                </div>

                <div>
                  <FieldLabel>Signature plain text</FieldLabel>
                  <TextArea
                    value={settings.signatureText}
                    onChange={(value) => updateField("signatureText", value)}
                    placeholder={"Kind regards,\nYour name"}
                    rows={10}
                  />
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white">
                <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-600">
                  Signature preview
                </div>
                <div className="p-4 text-slate-900">
                  <div
                    dangerouslySetInnerHTML={{
                      __html:
                        settings.signatureHtml || "<p>No signature preview.</p>",
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
                    {settings.googleConnected ? "Reconnect Google" : "Connect Google"}
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
                            settings.senderEmail ? ` <${settings.senderEmail}>` : ""
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
                  "Use reply-to only if you want replies to go somewhere different.",
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