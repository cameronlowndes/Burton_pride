"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

type FooterLinkSection = "explore" | "get_involved";

type FooterLink = {
  id?: string;
  label: string;
  url: string;
  section: FooterLinkSection;
  sortOrder: number;
  isEnabled: boolean;
};

type FooterSettings = {
  tagline: string;
  organisationName: string;
  description: string;
  companyText: string;

  facebookUrl: string;
  facebookEnabled: boolean;

  instagramUrl: string;
  instagramEnabled: boolean;

  blueskyUrl: string;
  blueskyEnabled: boolean;

  supportButtonText: string;
  supportButtonUrl: string;
  supportButtonEnabled: boolean;

  adminLoginText: string;
  adminLoginUrl: string;
  adminLoginEnabled: boolean;

  developerCreditPrefix: string;
  developerCreditText: string;
  developerCreditUrl: string;
  developerCreditEnabled: boolean;

  copyrightText: string;
};

type FooterAdminResponse = {
  success: boolean;
  settings?: Partial<FooterSettings>;
  links?: FooterLink[];
  error?: string;
  details?: string;
};

const EMPTY_SETTINGS: FooterSettings = {
  tagline: "",
  organisationName: "",
  description: "",
  companyText: "",

  facebookUrl: "",
  facebookEnabled: false,

  instagramUrl: "",
  instagramEnabled: false,

  blueskyUrl: "",
  blueskyEnabled: false,

  supportButtonText: "",
  supportButtonUrl: "",
  supportButtonEnabled: false,

  adminLoginText: "",
  adminLoginUrl: "",
  adminLoginEnabled: false,

  developerCreditPrefix: "",
  developerCreditText: "",
  developerCreditUrl: "",
  developerCreditEnabled: false,

  copyrightText: "",
};


function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
      <div className="mb-6">
        <h2 className="text-xl font-black text-white">{title}</h2>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-white/80">
        {label}
      </span>

      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className="
            w-full
            resize-y
            rounded-2xl
            border
            border-white/10
            bg-black/30
            px-4
            py-3
            text-sm
            text-white
            outline-none
            transition
            placeholder:text-white/25
            focus:border-purple-400
            focus:ring-4
            focus:ring-purple-500/15
          "
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="
            h-12
            w-full
            rounded-2xl
            border
            border-white/10
            bg-black/30
            px-4
            text-sm
            text-white
            outline-none
            transition
            placeholder:text-white/25
            focus:border-purple-400
            focus:ring-4
            focus:ring-purple-500/15
          "
        />
      )}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="
        flex
        w-full
        items-center
        justify-between
        gap-4
        rounded-2xl
        border
        border-white/10
        bg-black/20
        px-4
        py-3
        text-left
        transition
        hover:bg-white/[0.06]
      "
    >
      <span className="text-sm font-bold text-white/80">{label}</span>

      <span
        className={`
          relative
          h-7
          w-12
          shrink-0
          rounded-full
          transition
          ${checked ? "bg-purple-500" : "bg-white/15"}
        `}
        aria-hidden="true"
      >
        <span
          className={`
            absolute
            top-1
            h-5
            w-5
            rounded-full
            bg-white
            transition
            ${checked ? "left-6" : "left-1"}
          `}
        />
      </span>
    </button>
  );
}

function LinkManager({
  title,
  section,
  links,
  onChange,
}: {
  title: string;
  section: FooterLinkSection;
  links: FooterLink[];
  onChange: (links: FooterLink[]) => void;
}) {
  const sectionLinks = useMemo(
    () =>
      links
        .filter((link) => link.section === section)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [links, section],
  );

  function updateLink(index: number, patch: Partial<FooterLink>) {
    const target = sectionLinks[index];

    onChange(
      links.map((link) =>
        link === target
          ? {
              ...link,
              ...patch,
            }
          : link,
      ),
    );
  }

  function removeLink(index: number) {
    const target = sectionLinks[index];
    onChange(links.filter((link) => link !== target));
  }

  function moveLink(index: number, direction: -1 | 1) {
    const destination = index + direction;

    if (destination < 0 || destination >= sectionLinks.length) {
      return;
    }

    const reordered = [...sectionLinks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(destination, 0, moved);

    const withOrders = reordered.map((link, order) => ({
      ...link,
      sortOrder: order + 1,
    }));

    const otherLinks = links.filter((link) => link.section !== section);
    onChange([...otherLinks, ...withOrders]);
  }

  function addLink() {
    const nextOrder =
      Math.max(0, ...sectionLinks.map((link) => link.sortOrder)) + 1;

    onChange([
      ...links,
      {
        label: "",
        url: "",
        section,
        sortOrder: nextOrder,
        isEnabled: true,
      },
    ]);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-black text-white">{title}</h3>

        <button
          type="button"
          onClick={addLink}
          className="
            inline-flex
            h-10
            items-center
            gap-2
            rounded-xl
            bg-purple-500
            px-4
            text-sm
            font-black
            text-white
            transition
            hover:bg-purple-400
          "
        >
          <Plus size={16} />
          Add link
        </button>
      </div>

      {sectionLinks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-6 text-center text-sm text-white/45">
          No links in this section yet.
        </div>
      ) : (
        <div className="space-y-4">
          {sectionLinks.map((link, index) => (
            <div
              key={link.id ?? `${section}-${index}`}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr_auto]">
                <Field
                  label="Link name"
                  value={link.label}
                  onChange={(value) => updateLink(index, { label: value })}
                  placeholder="Example: About Burton Pride"
                />

                <Field
                  label="URL / path"
                  value={link.url}
                  onChange={(value) => updateLink(index, { url: value })}
                  placeholder="/about or https://example.com"
                />

                <div>
                  <span className="mb-2 block text-sm font-bold text-white/80">
                    Actions
                  </span>

                  <div className="flex h-12 items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateLink(index, {
                          isEnabled: !link.isEnabled,
                        })
                      }
                      title={link.isEnabled ? "Hide link" : "Show link"}
                      className="
                        flex
                        h-10
                        w-10
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-white/10
                        bg-white/5
                        text-white
                        transition
                        hover:bg-white/10
                      "
                    >
                      {link.isEnabled ? (
                        <Eye size={17} />
                      ) : (
                        <EyeOff size={17} />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => moveLink(index, -1)}
                      disabled={index === 0}
                      title="Move up"
                      className="
                        flex
                        h-10
                        w-10
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-white/10
                        bg-white/5
                        text-white
                        transition
                        hover:bg-white/10
                        disabled:cursor-not-allowed
                        disabled:opacity-25
                      "
                    >
                      <ArrowUp size={17} />
                    </button>

                    <button
                      type="button"
                      onClick={() => moveLink(index, 1)}
                      disabled={index === sectionLinks.length - 1}
                      title="Move down"
                      className="
                        flex
                        h-10
                        w-10
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-white/10
                        bg-white/5
                        text-white
                        transition
                        hover:bg-white/10
                        disabled:cursor-not-allowed
                        disabled:opacity-25
                      "
                    >
                      <ArrowDown size={17} />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeLink(index)}
                      title="Remove link"
                      className="
                        flex
                        h-10
                        w-10
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-red-500/20
                        bg-red-500/10
                        text-red-300
                        transition
                        hover:bg-red-500/20
                      "
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </div>

              {!link.isEnabled && (
                <p className="mt-3 text-xs font-bold text-amber-300">
                  Hidden from the public footer.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FooterManagementPage() {
  const [settings, setSettings] =
    useState<FooterSettings>(EMPTY_SETTINGS);
  const [links, setLinks] = useState<FooterLink[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);

  useEffect(() => {
    void loadFooter();
  }, []);

  async function loadFooter() {
    setLoading(true);
    setError(null);
    setDetails(null);

    try {
      const response = await fetch("/api/admin/footer", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const body = (await response.json().catch(() => null)) as
        | FooterAdminResponse
        | null;

      if (!response.ok || !body?.success) {
        throw new Error(
          body?.details ||
            body?.error ||
            `Request failed with status ${response.status}`,
        );
      }

      setSettings({
        ...EMPTY_SETTINGS,
        ...(body.settings ?? {}),
      });

      setLinks(body.links ?? []);
    } catch (caughtError) {
      const text =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load footer settings.";

      setError("Unable to load footer management data.");

      setDetails(text);
    } finally {
      setLoading(false);
    }
  }

  function updateSetting<K extends keyof FooterSettings>(
    key: K,
    value: FooterSettings[K],
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validate() {
    for (const link of links) {
      if (!link.label.trim() && link.url.trim()) {
        return "Every footer link with a URL needs a name.";
      }

      if (link.label.trim() && !link.url.trim()) {
        return `The link "${link.label}" needs a URL or path.`;
      }
    }

    return null;
  }

  async function saveFooter(event: FormEvent) {
    event.preventDefault();

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      setMessage(null);
      return;
    }

    setSaving(true);
    setError(null);
    setDetails(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/footer", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          settings,
          links: links.map((link, index) => ({
            ...link,
            label: link.label.trim(),
            url: link.url.trim(),
            sortOrder: link.sortOrder || index + 1,
          })),
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | FooterAdminResponse
        | null;

      if (!response.ok || !body?.success) {
        throw new Error(
          body?.details ||
            body?.error ||
            `Save failed with status ${response.status}`,
        );
      }

      setMessage("Footer saved successfully.");

      if (body.settings) {
        setSettings({
          ...EMPTY_SETTINGS,
          ...body.settings,
        });
      }

      if (body.links) {
        setLinks(body.links);
      }
    } catch (caughtError) {
      const text =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save footer.";

      setError("Footer could not be saved.");

      setDetails(text);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#090b12] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="flex w-full items-center justify-center py-32">
          <div className="flex items-center gap-3 text-white/65">
            <Loader2 className="animate-spin" size={22} />
            <span className="font-bold">Loading footer management…</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="
        min-h-screen
        w-full
        bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.16),transparent_30%),#090b12]
        px-4
        py-8
        text-white
        sm:px-6
        lg:px-8
        xl:px-10
      "
    >
      <form onSubmit={saveFooter} className="w-full">
        <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-purple-300">
              Website Management
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Footer Management
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55 sm:text-base">
              Control the public website footer from the Admin Portal.
              Links are not hard-coded into the public footer.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex
                h-12
                items-center
                gap-2
                rounded-2xl
                border
                border-white/10
                bg-white/5
                px-5
                text-sm
                font-black
                text-white
                transition
                hover:bg-white/10
              "
            >
              <ExternalLink size={17} />
              View website
            </a>

            <button
              type="submit"
              disabled={saving}
              className="
                inline-flex
                h-12
                items-center
                gap-2
                rounded-2xl
                bg-purple-500
                px-6
                text-sm
                font-black
                text-white
                shadow-lg
                transition
                hover:bg-purple-400
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {saving ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}

              {saving ? "Saving…" : "Save footer"}
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-sm font-bold text-emerald-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-4">
            <p className="text-sm font-black text-red-200">{error}</p>

            {details && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-red-300">
                  Detailed admin error
                </p>

                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-red-500/15 bg-black/40 p-4 text-xs leading-5 text-red-100">
                  {details}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          <SectionCard
            title="Organisation information"
            description="Main text shown in the first area of the footer."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <Field
                label="Tagline"
                value={settings.tagline}
                onChange={(value) => updateSetting("tagline", value)}
                placeholder="Grassroots • Community Led"
              />

              <Field
                label="Organisation name"
                value={settings.organisationName}
                onChange={(value) =>
                  updateSetting("organisationName", value)
                }
                placeholder="Burton Pride"
              />

              <div className="lg:col-span-2">
                <Field
                  label="Description"
                  value={settings.description}
                  onChange={(value) =>
                    updateSetting("description", value)
                  }
                  multiline
                />
              </div>

              <div className="lg:col-span-2">
                <Field
                  label="Company / CIC text"
                  value={settings.companyText}
                  onChange={(value) =>
                    updateSetting("companyText", value)
                  }
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Social media"
            description="Each social icon only appears when it is enabled and has a URL."
          >
            <div className="grid gap-5 xl:grid-cols-3">
              <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <Toggle
                  checked={settings.facebookEnabled}
                  onChange={(value) =>
                    updateSetting("facebookEnabled", value)
                  }
                  label="Facebook enabled"
                />

                <Field
                  label="Facebook URL"
                  value={settings.facebookUrl}
                  onChange={(value) =>
                    updateSetting("facebookUrl", value)
                  }
                  type="url"
                />
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <Toggle
                  checked={settings.instagramEnabled}
                  onChange={(value) =>
                    updateSetting("instagramEnabled", value)
                  }
                  label="Instagram enabled"
                />

                <Field
                  label="Instagram URL"
                  value={settings.instagramUrl}
                  onChange={(value) =>
                    updateSetting("instagramUrl", value)
                  }
                  type="url"
                />
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <Toggle
                  checked={settings.blueskyEnabled}
                  onChange={(value) =>
                    updateSetting("blueskyEnabled", value)
                  }
                  label="Bluesky enabled"
                />

                <Field
                  label="Bluesky URL"
                  value={settings.blueskyUrl}
                  onChange={(value) =>
                    updateSetting("blueskyUrl", value)
                  }
                  type="url"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Footer links"
            description="Add, remove, reorder and hide links. The public footer only displays what is saved here."
          >
            <div className="space-y-8">
              <LinkManager
                title="Explore"
                section="explore"
                links={links}
                onChange={setLinks}
              />

              <div className="border-t border-white/10" />

              <LinkManager
                title="Get Involved"
                section="get_involved"
                links={links}
                onChange={setLinks}
              />
            </div>
          </SectionCard>

          <SectionCard title="Support button">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <Toggle
                  checked={settings.supportButtonEnabled}
                  onChange={(value) =>
                    updateSetting("supportButtonEnabled", value)
                  }
                  label="Show support button"
                />
              </div>

              <Field
                label="Button text"
                value={settings.supportButtonText}
                onChange={(value) =>
                  updateSetting("supportButtonText", value)
                }
              />

              <Field
                label="Button URL / path"
                value={settings.supportButtonUrl}
                onChange={(value) =>
                  updateSetting("supportButtonUrl", value)
                }
              />
            </div>
          </SectionCard>

          <SectionCard title="Admin login footer link">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <Toggle
                  checked={settings.adminLoginEnabled}
                  onChange={(value) =>
                    updateSetting("adminLoginEnabled", value)
                  }
                  label="Show admin login link"
                />
              </div>

              <Field
                label="Link text"
                value={settings.adminLoginText}
                onChange={(value) =>
                  updateSetting("adminLoginText", value)
                }
              />

              <Field
                label="Admin login URL / path"
                value={settings.adminLoginUrl}
                onChange={(value) =>
                  updateSetting("adminLoginUrl", value)
                }
              />
            </div>
          </SectionCard>

          <SectionCard title="Developer credit">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <Toggle
                  checked={settings.developerCreditEnabled}
                  onChange={(value) =>
                    updateSetting("developerCreditEnabled", value)
                  }
                  label="Show developer credit"
                />
              </div>

              <Field
                label="Prefix"
                value={settings.developerCreditPrefix}
                onChange={(value) =>
                  updateSetting("developerCreditPrefix", value)
                }
                placeholder="Built & Powered by"
              />

              <Field
                label="Developer / company name"
                value={settings.developerCreditText}
                onChange={(value) =>
                  updateSetting("developerCreditText", value)
                }
              />

              <div className="lg:col-span-2">
                <Field
                  label="Developer credit URL"
                  value={settings.developerCreditUrl}
                  onChange={(value) =>
                    updateSetting("developerCreditUrl", value)
                  }
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Copyright"
            description="Enter the complete copyright line exactly as you want it displayed."
          >
            <Field
              label="Copyright text"
              value={settings.copyrightText}
              onChange={(value) =>
                updateSetting("copyrightText", value)
              }
              placeholder="© 2026 Burton Pride. All rights reserved."
            />
          </SectionCard>

          <div className="flex justify-end pb-8">
            <button
              type="submit"
              disabled={saving}
              className="
                inline-flex
                h-12
                items-center
                gap-2
                rounded-2xl
                bg-purple-500
                px-7
                text-sm
                font-black
                text-white
                shadow-lg
                transition
                hover:bg-purple-400
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {saving ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}

              {saving ? "Saving…" : "Save footer"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
