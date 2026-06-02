"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  Save,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

type AdminRole = "main_admin" | "admin" | "editor";

type AdminUser = {
  id: string;
  supabase_user_id: string | null;
  email: string | null;
  full_name?: string | null;
  role: AdminRole;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  permissions?: string[];
};

type PermissionItem = {
  key: string;
  label: string;
  description: string;
};

type PermissionGroup = {
  title: string;
  description: string;
  permissions: PermissionItem[];
};

const roleOptions: { value: AdminRole; label: string; description: string }[] = [
  {
    value: "main_admin",
    label: "Main Admin",
    description:
      "Full access, including all pages, delete all, year deletion, sponsor totals and permissions.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Can only use the admin portal pages and actions you tick below.",
  },
  {
    value: "editor",
    label: "Editor",
    description:
      "Limited access. Usually used for website pages or view-only admin tasks.",
  },
];

const permissionGroups: PermissionGroup[] = [
  {
    title: "Admin Portal",
    description: "Main admin level access to the portal and admin user tools.",
    permissions: [
      {
        key: "admin:dashboard:view",
        label: "View admin dashboard",
        description: "Can open the main admin dashboard.",
      },
      {
        key: "admin:users:manage",
        label: "Manage admin users",
        description: "Can add admins, change roles and change permissions.",
      },
    ],
  },
  {
    title: "Money Tracker",
    description: "Control what the admin can do in the money tracker.",
    permissions: [
      {
        key: "money:view",
        label: "View money tracker",
        description: "Can open the money tracker page.",
      },
      {
        key: "money:add_transactions",
        label: "Add transactions",
        description: "Can add new income, spending and receipt uploads.",
      },
      {
        key: "money:edit_transactions",
        label: "Edit transactions",
        description: "Can edit existing transactions.",
      },
      {
        key: "money:edit_old_years",
        label: "Edit old financial years",
        description: "Can edit transactions from previous years.",
      },
      {
        key: "money:hide_transactions",
        label: "Hide transactions",
        description: "Can soft-delete or hide transactions.",
      },
      {
        key: "money:delete_all",
        label: "Delete all transactions",
        description: "Dangerous action. Main admin only recommended.",
      },
      {
        key: "money:delete_year",
        label: "Delete selected year",
        description: "Dangerous action. Main admin only recommended.",
      },
      {
        key: "money:manage_year_locks",
        label: "Manage year locks",
        description: "Can lock or unlock financial years.",
      },
      {
        key: "money:manage_sponsors",
        label: "Manage sponsors and grants",
        description: "Can add, edit and remove restricted funding records.",
      },
      {
        key: "money:change_sponsor_totals",
        label: "Change sponsor / grant totals",
        description: "Can change agreed and received funding totals.",
      },
      {
        key: "money:sync_website_payments",
        label: "Sync website payments",
        description: "Can pull live Stripe website payments into the tracker.",
      },
      {
        key: "money:print_reports",
        label: "Print money reports",
        description: "Can print money reports.",
      },
      {
        key: "money:export_reports",
        label: "Export money reports",
        description: "Can export Excel and yearly reports.",
      },
      {
        key: "money:manage_refunds",
        label: "Manage refunds",
        description: "Can view and manage refund tracker records.",
      },
    ],
  },
  {
    title: "Donations",
    description: "Donation admin and supporter wall access.",
    permissions: [
      {
        key: "donations:view",
        label: "View donations admin",
        description: "Can view donation records and supporter wall details.",
      },
      {
        key: "donations:manage",
        label: "Manage donations",
        description: "Can approve, edit or manage donation records.",
      },
    ],
  },
  {
    title: "Raffle",
    description: "Raffle entries, payments and winner draw access.",
    permissions: [
      {
        key: "raffle:view",
        label: "View raffle admin",
        description: "Can view raffle entries and raffle stats.",
      },
      {
        key: "raffle:manage",
        label: "Manage raffle entries",
        description: "Can update, tidy or manage raffle entries.",
      },
      {
        key: "raffle:draw_winners",
        label: "Draw raffle winners",
        description: "Can run or redo the official raffle draw.",
      },
    ],
  },
  {
    title: "Website Pages",
    description: "Admin tools for site pages, nav and page visibility.",
    permissions: [
      {
        key: "site_pages:view",
        label: "View site pages admin",
        description: "Can view the site pages admin area.",
      },
      {
        key: "site_pages:manage",
        label: "Manage site pages",
        description: "Can update page status, nav settings and page messages.",
      },
    ],
  },
  {
    title: "Audit Logs",
    description: "View account, money and admin audit logs.",
    permissions: [
      {
        key: "audit_logs:view",
        label: "View audit logs",
        description: "Can view audit logs across the admin portal.",
      },
    ],
  },
];

const allPermissionKeys = permissionGroups.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
);

const defaultPermissionsByRole: Record<AdminRole, string[]> = {
  main_admin: allPermissionKeys,
  admin: [
    "admin:dashboard:view",
    "money:view",
    "money:add_transactions",
    "money:print_reports",
    "money:export_reports",
  ],
  editor: ["admin:dashboard:view"],
};

async function readJsonResponse(res: Response) {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { rawResponse: text };
  }
}

function normalisePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0);
}

function roleLabel(role: AdminRole) {
  if (role === "main_admin") return "Main Admin";
  if (role === "editor") return "Editor";
  return "Admin";
}

function roleBadgeClass(role: AdminRole) {
  if (role === "main_admin") {
    return "border-purple-300/30 bg-purple-500/10 text-purple-100";
  }

  if (role === "editor") {
    return "border-sky-300/30 bg-sky-500/10 text-sky-100";
  }

  return "border-emerald-300/30 bg-emerald-500/10 text-emerald-100";
}

function permissionCount(role: AdminRole, permissions: string[] | undefined) {
  if (role === "main_admin") return allPermissionKeys.length;
  return normalisePermissions(permissions).length;
}

export default function AdminUsersClient() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");
  const [isActive, setIsActive] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    defaultPermissionsByRole.admin
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Admin Portal": true,
    "Money Tracker": true,
  });

  const [expandedAdminId, setExpandedAdminId] = useState<string | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<
    Record<string, string[]>
  >({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeAdmins = useMemo(
    () => admins.filter((admin) => admin.is_active),
    [admins]
  );

  const mainAdmins = useMemo(
    () => admins.filter((admin) => admin.role === "main_admin" && admin.is_active),
    [admins]
  );

  async function loadAdmins() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const res = await fetch(`/api/admin/users?t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Failed to load admin users.");
      }

      const nextAdmins = (data.admins || []).map((admin: AdminUser) => ({
        ...admin,
        permissions:
          admin.role === "main_admin"
            ? allPermissionKeys
            : normalisePermissions(admin.permissions),
      }));

      setAdmins(nextAdmins);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong loading admin users."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  function toggleGroup(title: string) {
    setOpenGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  }

  function changeRole(nextRole: AdminRole) {
    setRole(nextRole);
    setSelectedPermissions(defaultPermissionsByRole[nextRole]);
  }

  function toggleSelectedPermission(permissionKey: string) {
    if (role === "main_admin") return;

    setSelectedPermissions((prev) => {
      if (prev.includes(permissionKey)) {
        return prev.filter((item) => item !== permissionKey);
      }

      return [...prev, permissionKey];
    });
  }

  function toggleDraftPermission(adminId: string, permissionKey: string) {
    const admin = admins.find((item) => item.id === adminId);

    if (admin?.role === "main_admin") return;

    setDraftPermissions((prev) => {
      const existing = prev[adminId] || [];

      if (existing.includes(permissionKey)) {
        return {
          ...prev,
          [adminId]: existing.filter((item) => item !== permissionKey),
        };
      }

      return {
        ...prev,
        [adminId]: [...existing, permissionKey],
      };
    });
  }

  function startEditPermissions(admin: AdminUser) {
    setExpandedAdminId((prev) => (prev === admin.id ? null : admin.id));

    setDraftPermissions((prev) => ({
      ...prev,
      [admin.id]:
        admin.role === "main_admin"
          ? allPermissionKeys
          : normalisePermissions(admin.permissions),
    }));
  }

  async function addOrUpdateAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const cleanEmail = email.trim().toLowerCase();
      const cleanFullName = fullName.trim();

      if (!cleanEmail) {
        setError("Please enter an email address.");
        return;
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: cleanFullName || null,
          role,
          isActive,
          permissions:
            role === "main_admin" ? allPermissionKeys : selectedPermissions,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Failed to save admin user.");
      }

      setMessage(data.message || "Admin user saved.");
      setEmail("");
      setFullName("");
      setRole("admin");
      setIsActive(true);
      setSelectedPermissions(defaultPermissionsByRole.admin);

      await loadAdmins();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong saving admin user."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateAdmin(
    admin: AdminUser,
    nextValues: Partial<AdminUser>,
    nextPermissions?: string[]
  ) {
    try {
      setUpdatingId(admin.id);
      setError("");
      setMessage("");

      const nextRole = (nextValues.role || admin.role) as AdminRole;
      const nextIsActive =
        typeof nextValues.is_active === "boolean"
          ? nextValues.is_active
          : admin.is_active;

      const permissionsToSave =
        nextRole === "main_admin"
          ? allPermissionKeys
          : nextPermissions ||
            draftPermissions[admin.id] ||
            normalisePermissions(admin.permissions);

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: admin.id,
          role: nextRole,
          isActive: nextIsActive,
          permissions: permissionsToSave,
          fullName:
            typeof nextValues.full_name === "string"
              ? nextValues.full_name
              : admin.full_name ?? null,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Failed to update admin user.");
      }

      setMessage(data.message || "Admin user updated.");
      await loadAdmins();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong updating admin user."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveAdminPermissions(admin: AdminUser) {
    const permissionsToSave =
      admin.role === "main_admin"
        ? allPermissionKeys
        : draftPermissions[admin.id] || normalisePermissions(admin.permissions);

    await updateAdmin(admin, {}, permissionsToSave);
    setExpandedAdminId(null);
  }

  function renderMainAdminPermissionsCard() {
    return (
      <div className="rounded-2xl border border-purple-300/25 bg-purple-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl border border-purple-300/25 bg-purple-500/20 p-2 text-purple-100">
            <ShieldCheck className="h-4 w-4" />
          </div>

          <div>
            <p className="text-sm font-black text-white">
              Main admin gets every permission automatically
            </p>

            <p className="mt-1 text-xs leading-5 text-white/55">
              You do not need to tick individual boxes for a main admin. They
              can access all admin portal pages and all high-risk actions.
            </p>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-purple-100">
              {allPermissionKeys.length} permissions included automatically
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderPermissionGroups(args: {
    roleValue: AdminRole;
    permissions: string[];
    disabled?: boolean;
    onToggle: (permissionKey: string) => void;
  }) {
    if (args.roleValue === "main_admin") {
      return renderMainAdminPermissionsCard();
    }

    const disabled = args.disabled === true;

    return (
      <div className="space-y-3">
        {permissionGroups.map((group) => {
          const isOpen = openGroups[group.title] !== false;
          const groupPermissionKeys = group.permissions.map(
            (permission) => permission.key
          );
          const enabledInGroup = groupPermissionKeys.filter((key) =>
            args.permissions.includes(key)
          ).length;

          return (
            <div
              key={group.title}
              className="rounded-2xl border border-white/10 bg-black/20"
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-black text-white">{group.title}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {group.description}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-purple-100/70">
                    {enabledInGroup} of {groupPermissionKeys.length} enabled
                  </p>
                </div>

                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-white/60" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-white/60" />
                )}
              </button>

              {isOpen && (
                <div className="space-y-2 border-t border-white/10 p-3">
                  {group.permissions.map((permission) => {
                    const checked = args.permissions.includes(permission.key);

                    return (
                      <label
                        key={permission.key}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                          checked
                            ? "border-sky-300/25 bg-sky-500/10"
                            : "border-white/10 bg-black/20 hover:bg-white/5"
                        } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => args.onToggle(permission.key)}
                          className="mt-1"
                        />

                        <div>
                          <p className="text-sm font-bold text-white">
                            {permission.label}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-white/45">
                            {permission.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full bg-transparent px-3 py-5 text-white sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <section className="rounded-3xl border border-white/15 bg-[#0b0b1f]/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-100">
                  <Users className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-200">
                    Admin Portal
                  </p>
                  <h1 className="text-2xl font-black text-white sm:text-3xl">
                    Admin Users & Permissions
                  </h1>
                </div>
              </div>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
                Main admin only page. Add admins by email, choose their role and
                decide which admin portal pages and actions they can use.
              </p>
            </div>

            <button
              type="button"
              onClick={loadAdmins}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-white/40">
                Total Admins
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                {admins.length}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-100/70">
                Active Admins
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-100">
                {activeAdmins.length}
              </p>
            </div>

            <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-purple-100/70">
                Main Admins
              </p>
              <p className="mt-1 text-2xl font-black text-purple-100">
                {mainAdmins.length}
              </p>
            </div>
          </div>
        </section>

        {(message || error) && (
          <section
            className={`rounded-3xl border p-4 text-sm font-semibold backdrop-blur-xl ${
              error
                ? "border-red-400/30 bg-red-500/10 text-red-100"
                : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {error || message}
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[500px_minmax(0,1fr)]">
          <form
            onSubmit={addOrUpdateAdmin}
            className="rounded-3xl border border-white/15 bg-[#0b0b1f]/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-100">
                <UserPlus className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-xl font-black text-white">Add Admin</h2>
                <p className="text-sm text-white/55">
                  Type their email, choose role and permissions.
                </p>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-bold text-white/70">
                Email address
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="name@example.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-300/40"
              />
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-bold text-white/70">
                Display name
              </span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                type="text"
                placeholder="Cameron Lowndes"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-300/40"
              />
            </label>

            <div className="mt-5 space-y-3">
              <p className="text-sm font-bold text-white/70">Role</p>

              {roleOptions.map((option) => (
                <label
                  key={option.value}
                  className={`block cursor-pointer rounded-2xl border p-4 transition ${
                    role === option.value
                      ? "border-purple-300/50 bg-purple-500/15"
                      : "border-white/10 bg-black/20 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={role === option.value}
                      onChange={() => changeRole(option.value)}
                      className="mt-1"
                    />

                    <div>
                      <p className="font-bold text-white">{option.label}</p>
                      <p className="mt-1 text-xs leading-5 text-white/55">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5">
              <div className="mb-3 flex flex-col gap-1">
                <p className="text-sm font-bold text-white/70">
                  Admin portal permissions
                </p>
                <p className="text-xs leading-5 text-white/45">
                  {role === "main_admin"
                    ? "Main admin permissions are automatic, so the boxes are hidden."
                    : "Tick the pages and actions this admin can use."}
                </p>
              </div>

              {renderPermissionGroups({
                roleValue: role,
                permissions: selectedPermissions,
                onToggle: toggleSelectedPermission,
              })}
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <div>
                <p className="text-sm font-bold text-white">Active admin</p>
                <p className="text-xs text-white/50">
                  Turn this off to create or update the user as inactive.
                </p>
              </div>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/30 hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Admin"}
            </button>

            <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100/80">
              Safety note: only main admins should give main admin access or
              dangerous money permissions.
            </p>
          </form>

          <section className="min-w-0 rounded-3xl border border-white/15 bg-[#0b0b1f]/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-100">
                <UserCog className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-xl font-black text-white">
                  Current Admin Users
                </h2>
                <p className="text-sm text-white/55">
                  Change roles, permissions or deactivate access.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-sm text-white/60">
                Loading admin users...
              </div>
            ) : admins.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center text-sm text-white/60">
                No admin users found.
              </div>
            ) : (
              <div className="space-y-4">
                {admins.map((admin) => {
                  const adminPermissions =
                    draftPermissions[admin.id] ||
                    normalisePermissions(admin.permissions);

                  return (
                    <div
                      key={admin.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${roleBadgeClass(
                                admin.role
                              )}`}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {roleLabel(admin.role)}
                            </span>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                                admin.is_active
                                  ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                                  : "border-red-300/30 bg-red-500/10 text-red-100"
                              }`}
                            >
                              {admin.is_active ? "Active" : "Inactive"}
                            </span>

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                                admin.supabase_user_id
                                  ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                                  : "border-amber-300/30 bg-amber-500/10 text-amber-100"
                              }`}
                            >
                              {admin.supabase_user_id
                                ? "Supabase linked"
                                : "Not linked"}
                            </span>
                          </div>

                          <p className="mt-3 break-words text-base font-black text-white">
                            {admin.full_name || admin.email || "No name saved"}
                          </p>

                          <p className="mt-1 break-words text-sm text-white/55">
                            {admin.email || "No email saved"}
                          </p>

                          <p className="mt-2 break-words text-xs text-white/35">
                            Supabase user ID:{" "}
                            {admin.supabase_user_id || "Not linked yet"}
                          </p>

                          <p className="mt-2 text-xs text-white/35">
                            Added:{" "}
                            {admin.created_at
                              ? new Date(admin.created_at).toLocaleDateString(
                                  "en-GB"
                                )
                              : "Unknown"}
                          </p>
                        </div>

                        <div className="flex w-full flex-col gap-3 2xl:w-[280px]">
                          <label>
                            <span className="text-xs font-bold text-white/50">
                              Role
                            </span>
                            <select
                              value={admin.role}
                              disabled={updatingId === admin.id}
                              onChange={(e) =>
                                updateAdmin(
                                  admin,
                                  {
                                    role: e.target.value as AdminRole,
                                  },
                                  defaultPermissionsByRole[
                                    e.target.value as AdminRole
                                  ]
                                )
                              }
                              className="mt-1 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                            >
                              {roleOptions.map((option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                  className="bg-[#070716] text-white"
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <button
                            type="button"
                            disabled={updatingId === admin.id}
                            onClick={() =>
                              updateAdmin(admin, {
                                is_active: !admin.is_active,
                              })
                            }
                            className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                              admin.is_active
                                ? "border border-red-300/20 bg-red-500/10 text-red-100 hover:bg-red-500/20"
                                : "border border-emerald-300/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                            }`}
                          >
                            {updatingId === admin.id
                              ? "Updating..."
                              : admin.is_active
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-bold text-white">
                              Permissions
                            </p>
                            <p className="text-xs text-white/45">
                              {admin.role === "main_admin"
                                ? "Main admins automatically have all permissions."
                                : `${permissionCount(
                                    admin.role,
                                    admin.permissions
                                  )} permissions enabled.`}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => startEditPermissions(admin)}
                            className="inline-flex items-center justify-center rounded-xl border border-purple-300/20 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-100 hover:bg-purple-500/20"
                          >
                            {admin.role === "main_admin"
                              ? expandedAdminId === admin.id
                                ? "Close automatic permissions"
                                : "View automatic permissions"
                              : expandedAdminId === admin.id
                                ? "Close permissions"
                                : "Manage permissions"}
                          </button>
                        </div>

                        {expandedAdminId === admin.id && (
                          <div className="mt-4 space-y-4">
                            {renderPermissionGroups({
                              roleValue: admin.role,
                              permissions: adminPermissions,
                              onToggle: (permissionKey) =>
                                toggleDraftPermission(admin.id, permissionKey),
                            })}

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                              <button
                                type="button"
                                onClick={() => setExpandedAdminId(null)}
                                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
                              >
                                {admin.role === "main_admin" ? "Close" : "Cancel"}
                              </button>

                              {admin.role !== "main_admin" && (
                                <button
                                  type="button"
                                  disabled={updatingId === admin.id}
                                  onClick={() => saveAdminPermissions(admin)}
                                  className="rounded-xl bg-purple-500 px-4 py-2 text-xs font-black text-white hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updatingId === admin.id
                                    ? "Saving..."
                                    : "Save permissions"}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}