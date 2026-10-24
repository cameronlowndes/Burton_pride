"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  Star,
  Trash2,
} from "lucide-react";

type FooterLinkSection = "explore" | "get_involved";
type FooterMatchType = "exact" | "prefix";

type FooterProfile = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  isEnabled: boolean;
};

type FooterAssignment = {
  id?: string;
  footerProfileId: string;
  pathPattern: string;
  matchType: FooterMatchType;
  priority: number;
  isEnabled: boolean;
};

type FooterLink = {
  id?: string;
  footerProfileId?: string;
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
  profiles?: FooterProfile[];
  selectedProfile?: FooterProfile | null;
  settings?: Partial<FooterSettings>;
  links?: FooterLink[];
  assignments?: FooterAssignment[];
  error?: string;
  details?: string;
  message?: string;
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
          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/55">
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  disabled?: boolean;
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
          disabled={disabled}
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
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
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
            disabled:cursor-not-allowed
            disabled:opacity-50
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
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
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
        disabled:cursor-not-allowed
        disabled:opacity-50
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
              <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr_auto]">
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
  const [profiles, setProfiles] = useState<FooterProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  const [settings, setSettings] =
    useState<FooterSettings>(EMPTY_SETTINGS);
  const [links, setLinks] = useState<FooterLink[]>([]);
  const [assignments, setAssignments] = useState<FooterAssignment[]>([]);

  const [loading, setLoading] = useState(true);
  const [switchingProfile, setSwitchingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileActionLoading, setProfileActionLoading] = useState(false);

  const [newProfileName, setNewProfileName] = useState("");
  const [newAssignmentPath, setNewAssignmentPath] = useState("");
  const [newAssignmentMatchType, setNewAssignmentMatchType] =
    useState<FooterMatchType>("exact");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function readJson(response: Response) {
    return (await response.json().catch(() => null)) as
      | FooterAdminResponse
      | null;
  }

  function throwForBadResponse(
    response: Response,
    body: FooterAdminResponse | null,
    fallback: string,
  ) {
    if (!response.ok || !body?.success) {
      throw new Error(
        body?.details ||
          body?.error ||
          `${fallback} (HTTP ${response.status})`,
      );
    }
  }

  function resetMessages() {
    setMessage(null);
    setError(null);
    setDetails(null);
  }

  function showError(publicMessage: string, caughtError: unknown) {
    const text =
      caughtError instanceof Error
        ? caughtError.message
        : "Unknown Admin Portal error.";

    setError(publicMessage);
    setDetails(text);
  }

  async function loadInitialData() {
    setLoading(true);
    resetMessages();

    try {
      const response = await fetch("/api/admin/footer/profiles", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const body = await readJson(response);
      throwForBadResponse(response, body, "Unable to load footer profiles");

      const loadedProfiles = body?.profiles ?? [];
      setProfiles(loadedProfiles);

      const firstProfile =
        loadedProfiles.find((profile) => profile.isDefault) ??
        loadedProfiles[0] ??
        null;

      if (firstProfile) {
        setSelectedProfileId(firstProfile.id);
        await loadProfile(firstProfile.id, false);
      } else {
        setSettings(EMPTY_SETTINGS);
        setLinks([]);
        setAssignments([]);
      }
    } catch (caughtError) {
      showError("Unable to load footer management.", caughtError);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile(
    profileId: string,
    showLoader = true,
  ) {
    if (!profileId) {
      return;
    }

    if (showLoader) {
      setSwitchingProfile(true);
    }

    resetMessages();

    try {
      const response = await fetch(
        `/api/admin/footer?profileId=${encodeURIComponent(profileId)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      const body = await readJson(response);
      throwForBadResponse(response, body, "Unable to load footer");

      setSettings({
        ...EMPTY_SETTINGS,
        ...(body?.settings ?? {}),
      });

      setLinks(body?.links ?? []);
      setAssignments(body?.assignments ?? []);
    } catch (caughtError) {
      showError("Unable to load the selected footer.", caughtError);
    } finally {
      if (showLoader) {
        setSwitchingProfile(false);
      }
    }
  }

  async function handleProfileChange(profileId: string) {
    setSelectedProfileId(profileId);
    await loadProfile(profileId);
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

  function validateLinks() {
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

    if (!selectedProfileId) {
      setError("Select a footer before saving.");
      return;
    }

    const validationError = validateLinks();

    if (validationError) {
      setError(validationError);
      setMessage(null);
      return;
    }

    setSaving(true);
    resetMessages();

    try {
      const response = await fetch("/api/admin/footer", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          profileId: selectedProfileId,
          settings,
          links: links.map((link, index) => ({
            ...link,
            footerProfileId: selectedProfileId,
            label: link.label.trim(),
            url: link.url.trim(),
            sortOrder: link.sortOrder || index + 1,
          })),
        }),
      });

      const body = await readJson(response);
      throwForBadResponse(response, body, "Unable to save footer");

      setMessage(body?.message || "Footer saved successfully.");

      if (body?.settings) {
        setSettings({
          ...EMPTY_SETTINGS,
          ...body.settings,
        });
      }

      if (body?.links) {
        setLinks(body.links);
      }
    } catch (caughtError) {
      showError("Footer could not be saved.", caughtError);
    } finally {
      setSaving(false);
    }
  }

  async function createProfile() {
    const name = newProfileName.trim();

    if (!name) {
      setError("Enter a footer name first.");
      return;
    }

    setProfileActionLoading(true);
    resetMessages();

    try {
      const response = await fetch("/api/admin/footer/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name,
          copyFromProfileId: selectedProfileId || null,
        }),
      });

      const body = await readJson(response);
      throwForBadResponse(response, body, "Unable to create footer");

      const nextProfiles = body?.profiles ?? [];
      setProfiles(nextProfiles);

      const created =
        body?.selectedProfile ??
        nextProfiles[nextProfiles.length - 1] ??
        null;

      setNewProfileName("");

      if (created) {
        setSelectedProfileId(created.id);
        await loadProfile(created.id, false);
      }

      setMessage("New footer created.");
    } catch (caughtError) {
      showError("Unable to create footer.", caughtError);
    } finally {
      setProfileActionLoading(false);
    }
  }

  async function renameProfile() {
    if (!selectedProfile) {
      return;
    }

    const newName = window.prompt(
      "New footer name:",
      selectedProfile.name,
    );

    if (!newName?.trim()) {
      return;
    }

    setProfileActionLoading(true);
    resetMessages();

    try {
      const response = await fetch(
        `/api/admin/footer/profiles/${selectedProfile.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: newName.trim(),
          }),
        },
      );

      const body = await readJson(response);
      throwForBadResponse(response, body, "Unable to rename footer");

      setProfiles(body?.profiles ?? profiles);
      setMessage("Footer renamed.");
    } catch (caughtError) {
      showError("Unable to rename footer.", caughtError);
    } finally {
      setProfileActionLoading(false);
    }
  }

  async function setAsDefault() {
    if (!selectedProfile || selectedProfile.isDefault) {
      return;
    }

    setProfileActionLoading(true);
    resetMessages();

    try {
      const response = await fetch(
        `/api/admin/footer/profiles/${selectedProfile.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            isDefault: true,
          }),
        },
      );

      const body = await readJson(response);
      throwForBadResponse(response, body, "Unable to set default footer");

      setProfiles(body?.profiles ?? profiles);
      setMessage("Default footer updated.");
    } catch (caughtError) {
      showError("Unable to set default footer.", caughtError);
    } finally {
      setProfileActionLoading(false);
    }
  }

  async function deleteProfile() {
    if (!selectedProfile) {
      return;
    }

    if (selectedProfile.isDefault) {
      setError("The default footer cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${selectedProfile.name}"? Page assignments using it will also be removed.`,
    );

    if (!confirmed) {
      return;
    }

    setProfileActionLoading(true);
    resetMessages();

    try {
      const response = await fetch(
        `/api/admin/footer/profiles/${selectedProfile.id}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const body = await readJson(response);
      throwForBadResponse(response, body, "Unable to delete footer");

      const nextProfiles = body?.profiles ?? [];
      setProfiles(nextProfiles);

      const nextProfile =
        nextProfiles.find((profile) => profile.isDefault) ??
        nextProfiles[0] ??
        null;

      if (nextProfile) {
        setSelectedProfileId(nextProfile.id);
        await loadProfile(nextProfile.id, false);
      } else {
        setSelectedProfileId("");
        setSettings(EMPTY_SETTINGS);
        setLinks([]);
        setAssignments([]);
      }

      setMessage("Footer deleted.");
    } catch (caughtError) {
      showError("Unable to delete footer.", caughtError);
    } finally {
      setProfileActionLoading(false);
    }
  }

  async function addAssignment() {
    if (!selectedProfileId) {
      setError("Select a footer first.");
      return;
    }

    const path = newAssignmentPath.trim();

    if (!path) {
      setError("Enter a page path.");
      return;
    }

    if (!path.startsWith("/")) {
      setError("Page paths must start with /");
      return;
    }

    resetMessages();

    try {
      const response = await fetch("/api/admin/footer/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          footerProfileId: selectedProfileId,
          pathPattern: path,
          matchType: newAssignmentMatchType,
          priority: 0,
          isEnabled: true,
        }),
      });

      const body = await readJson(response);
      throwForBadResponse(response, body, "Unable to assign page");

      setAssignments(body?.assignments ?? []);
      setNewAssignmentPath("");
      setNewAssignmentMatchType("exact");
      setMessage("Page assignment added.");
    } catch (caughtError) {
      showError("Unable to assign page to footer.", caughtError);
    }
  }

  async function updateAssignment(
    assignment: FooterAssignment,
    patch: Partial<FooterAssignment>,
  ) {
    if (!assignment.id) {
      return;
    }

    resetMessages();

    try {
      const response = await fetch(
        `/api/admin/footer/assignments/${assignment.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(patch),
        },
      );

      const body = await readJson(response);
      throwForBadResponse(response, body, "Unable to update assignment");

      setAssignments(body?.assignments ?? assignments);
      setMessage("Page assignment updated.");
    } catch (caughtError) {
      showError("Unable to update page assignment.", caughtError);
    }
  }

  async function deleteAssignment(assignment: FooterAssignment) {
    if (!assignment.id) {
      return;
    }

    resetMessages();

    try {
      const response = await fetch(
        `/api/admin/footer/assignments/${assignment.id}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const body = await readJson(response);
      throwForBadResponse(response, body, "Unable to delete assignment");

      setAssignments(body?.assignments ?? []);
      setMessage("Page assignment removed.");
    } catch (caughtError) {
      showError("Unable to remove page assignment.", caughtError);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-[#090b12] px-4 py-10 text-white sm:px-6 lg:px-8">
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

            <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55 sm:text-base">
              Create different footer profiles and assign them to individual pages
              or whole sections of the public website.
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
              disabled={saving || !selectedProfileId}
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
            title="Footer profiles"
            description="The Default Footer is used whenever a page does not have a custom footer assignment."
          >
            <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-white/80">
                    Select footer
                  </span>

                  <select
                    value={selectedProfileId}
                    onChange={(event) =>
                      void handleProfileChange(event.target.value)
                    }
                    disabled={switchingProfile || profiles.length === 0}
                    className="
                      h-12
                      w-full
                      rounded-2xl
                      border
                      border-white/10
                      bg-[#121520]
                      px-4
                      text-sm
                      font-bold
                      text-white
                      outline-none
                      focus:border-purple-400
                      focus:ring-4
                      focus:ring-purple-500/15
                    "
                  >
                    {profiles.length === 0 && (
                      <option value="">No footer profiles</option>
                    )}

                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                        {profile.isDefault ? " — Default" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {switchingProfile && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-purple-200">
                    <Loader2 className="animate-spin" size={14} />
                    Loading selected footer…
                  </div>
                )}

                {selectedProfile && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {selectedProfile.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-300/15 px-3 py-1 text-xs font-black text-yellow-200">
                        <Star size={13} />
                        Default footer
                      </span>
                    )}

                    {!selectedProfile.isEnabled && (
                      <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-200">
                        Disabled
                      </span>
                    )}

                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-white/55">
                      {selectedProfile.slug}
                    </span>
                  </div>
                )}

                {selectedProfile && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={renameProfile}
                      disabled={profileActionLoading}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-50"
                    >
                      Rename
                    </button>

                    <button
                      type="button"
                      onClick={setAsDefault}
                      disabled={
                        profileActionLoading || selectedProfile.isDefault
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-black text-yellow-200 transition hover:bg-yellow-400/15 disabled:opacity-35"
                    >
                      <Star size={14} />
                      Make default
                    </button>

                    <button
                      type="button"
                      onClick={deleteProfile}
                      disabled={
                        profileActionLoading || selectedProfile.isDefault
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-black text-red-200 transition hover:bg-red-500/20 disabled:opacity-35"
                    >
                      <Trash2 size={14} />
                      Delete footer
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="text-base font-black text-white">
                  Create footer
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/45">
                  A new footer can start as a copy of the currently selected
                  footer so you only need to change what is different.
                </p>

                <div className="mt-4">
                  <Field
                    label="New footer name"
                    value={newProfileName}
                    onChange={setNewProfileName}
                    placeholder="Example: Lottery Footer"
                  />
                </div>

                <button
                  type="button"
                  onClick={createProfile}
                  disabled={profileActionLoading}
                  className="
                    mt-4
                    inline-flex
                    h-11
                    items-center
                    gap-2
                    rounded-xl
                    bg-purple-500
                    px-5
                    text-sm
                    font-black
                    text-white
                    transition
                    hover:bg-purple-400
                    disabled:opacity-50
                  "
                >
                  {profileActionLoading ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                  Create from selected footer
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Page assignments"
            description="Use Exact for one page only. Use Whole section for a path and everything underneath it."
          >
            {!selectedProfile ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-6 text-sm text-white/45">
                Select a footer profile first.
              </div>
            ) : (
              <>
                <div className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[1.4fr_0.7fr_auto]">
                  <Field
                    label="Page path"
                    value={newAssignmentPath}
                    onChange={setNewAssignmentPath}
                    placeholder="/about or /Lottery"
                  />

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-white/80">
                      Match type
                    </span>

                    <select
                      value={newAssignmentMatchType}
                      onChange={(event) =>
                        setNewAssignmentMatchType(
                          event.target.value as FooterMatchType,
                        )
                      }
                      className="
                        h-12
                        w-full
                        rounded-2xl
                        border
                        border-white/10
                        bg-[#121520]
                        px-4
                        text-sm
                        font-bold
                        text-white
                        outline-none
                        focus:border-purple-400
                        focus:ring-4
                        focus:ring-purple-500/15
                      "
                    >
                      <option value="exact">Exact page</option>
                      <option value="prefix">Whole section</option>
                    </select>
                  </label>

                  <div>
                    <span className="mb-2 block text-sm font-bold text-transparent">
                      Add
                    </span>

                    <button
                      type="button"
                      onClick={addAssignment}
                      className="
                        inline-flex
                        h-12
                        items-center
                        gap-2
                        rounded-2xl
                        bg-purple-500
                        px-5
                        text-sm
                        font-black
                        text-white
                        transition
                        hover:bg-purple-400
                      "
                    >
                      <Plus size={17} />
                      Assign page
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {assignments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-6 text-center text-sm text-white/45">
                      This footer has no page assignments. It will only be used
                      automatically if it is the Default Footer.
                    </div>
                  ) : (
                    assignments.map((assignment) => (
                      <div
                        key={assignment.id ?? assignment.pathPattern}
                        className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 xl:grid-cols-[1.4fr_0.7fr_0.5fr_auto]"
                      >
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.15em] text-white/35">
                            Path
                          </p>
                          <p className="mt-1 break-all text-sm font-black text-white">
                            {assignment.pathPattern}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.15em] text-white/35">
                            Match
                          </p>
                          <p className="mt-1 text-sm font-bold text-white/75">
                            {assignment.matchType === "exact"
                              ? "Exact page"
                              : "Whole section"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.15em] text-white/35">
                            Status
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              void updateAssignment(assignment, {
                                isEnabled: !assignment.isEnabled,
                              })
                            }
                            className={`mt-1 rounded-full px-3 py-1 text-xs font-black ${
                              assignment.isEnabled
                                ? "bg-emerald-500/15 text-emerald-200"
                                : "bg-white/10 text-white/45"
                            }`}
                          >
                            {assignment.isEnabled ? "Enabled" : "Disabled"}
                          </button>
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => void deleteAssignment(assignment)}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-xs font-black text-red-200 transition hover:bg-red-500/20"
                          >
                            <Trash2 size={15} />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </SectionCard>

          {selectedProfile && (
            <>
              <SectionCard
                title="Organisation information"
                description={`Editing: ${selectedProfile.name}`}
              >
                <div className="grid gap-5 lg:grid-cols-2">
                  <Field
                    label="Tagline"
                    value={settings.tagline}
                    onChange={(value) => updateSetting("tagline", value)}
                  />

                  <Field
                    label="Organisation name"
                    value={settings.organisationName}
                    onChange={(value) =>
                      updateSetting("organisationName", value)
                    }
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

              <SectionCard title="Social media">
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

              <SectionCard title="Footer links">
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

              <SectionCard title="Copyright">
                <Field
                  label="Copyright text"
                  value={settings.copyrightText}
                  onChange={(value) =>
                    updateSetting("copyrightText", value)
                  }
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
            </>
          )}
        </div>
      </form>
    </main>
  );
}
