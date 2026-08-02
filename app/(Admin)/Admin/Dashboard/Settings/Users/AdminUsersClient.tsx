"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
  X,
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
  two_factor_required?: boolean | null;
  two_factor_enabled?: boolean | null;
  two_factor_email_enabled?: boolean | null;
  two_factor_method?: "email" | "totp" | null;
};

type PermissionItem = {
  key: string;
  label: string;
  description: string;
  dangerous?: boolean;
  mainAdminRecommended?: boolean;
};

type PermissionGroup = {
  title: string;
  description: string;
  permissions: PermissionItem[];
};

type ApiResult = {
  ok?: boolean;
  message?: string;
  error?: string;
  reason?: string;
  likelyFix?: string;
  details?: unknown;
  debug?: unknown;
  admins?: AdminUser[];
};

type AdminFilter = "all" | "active" | "inactive" | "main_admin" | "admin" | "editor";

const roleOptions: {
  value: AdminRole;
  label: string;
  description: string;
}[] = [
  {
    value: "main_admin",
    label: "Main Admin",
    description:
      "Full access to every app, page, permission and high-risk action.",
  },
  {
    value: "admin",
    label: "Admin",
    description:
      "Access only to the pages and actions selected in the permission list.",
  },
  {
    value: "editor",
    label: "Editor",
    description:
      "Limited access for content updates, viewing records and lower-risk tasks.",
  },
];

const permissionGroups: PermissionGroup[] = [
  {
    title: "Admin Portal",
    description: "Core portal access, dashboard and admin account management.",
    permissions: [
      {
        key: "admin:dashboard:view",
        label: "View admin dashboard",
        description: "Can open the main Admin Portal dashboard.",
      },
      {
        key: "admin:users:view",
        label: "View admin users",
        description: "Can view admin accounts and their access status.",
      },
      {
        key: "admin:users:manage",
        label: "Manage admin users",
        description: "Can add admins, edit roles and change permissions.",
        dangerous: true,
        mainAdminRecommended: true,
      },
      {
        key: "admin:users:manage_2fa",
        label: "Manage two-step verification",
        description:
          "Can enable or update approved two-step verification settings for admins.",
        dangerous: true,
        mainAdminRecommended: true,
      },
      {
        key: "admin:sidebar:manage",
        label: "Manage admin sidebar",
        description:
          "Can add, reorder, hide and choose icons for Admin Portal sidebar pages.",
        dangerous: true,
        mainAdminRecommended: true,
      },
    ],
  },
  {
    title: "Money Management",
    description:
      "Transactions, budgets, suppliers, refunds, reconciliation and finance controls.",
    permissions: [
      {
        key: "money:view",
        label: "View Money Management",
        description: "Can open the Money Management app.",
      },
      {
        key: "money:add_transactions",
        label: "Add transactions",
        description: "Can add income, expenses, donations and personal payments.",
      },
      {
        key: "money:edit_transactions",
        label: "Edit transactions",
        description: "Can update existing financial records.",
      },
      {
        key: "money:hide_transactions",
        label: "Hide transactions",
        description: "Can hide or soft-delete transaction records.",
      },
      {
        key: "money:restore_transactions",
        label: "Restore hidden transactions",
        description: "Can restore previously hidden transaction records.",
      },
      {
        key: "money:edit_old_years",
        label: "Edit previous years",
        description: "Can edit transactions from previous financial years.",
        dangerous: true,
      },
      {
        key: "money:manage_month_locks",
        label: "Manage month locks",
        description: "Can lock and unlock individual financial months.",
        dangerous: true,
      },
      {
        key: "money:manage_year_locks",
        label: "Manage year locks",
        description: "Can lock and unlock financial years.",
        dangerous: true,
      },
      {
        key: "money:delete_year",
        label: "Delete a financial year",
        description: "Can permanently remove a selected financial year.",
        dangerous: true,
        mainAdminRecommended: true,
      },
      {
        key: "money:delete_all",
        label: "Delete all money records",
        description: "Can permanently remove all money records.",
        dangerous: true,
        mainAdminRecommended: true,
      },
      {
        key: "money:budgets:view",
        label: "View budgets",
        description: "Can view budget planning and remaining balances.",
      },
      {
        key: "money:budgets:manage",
        label: "Manage budgets",
        description: "Can create, edit and allocate budgets.",
      },
      {
        key: "money:sponsors:view",
        label: "View sponsors and grants",
        description: "Can view sponsorship and grant funding records.",
      },
      {
        key: "money:sponsors:manage",
        label: "Manage sponsors and grants",
        description: "Can add, edit and remove sponsor or grant records.",
      },
      {
        key: "money:sponsors:change_totals",
        label: "Change sponsor totals",
        description: "Can change agreed, received and outstanding funding totals.",
        dangerous: true,
      },
      {
        key: "money:suppliers:view",
        label: "View money suppliers",
        description: "Can view suppliers connected to Money Management.",
      },
      {
        key: "money:suppliers:manage",
        label: "Manage money suppliers",
        description: "Can add, edit, link and unlink supplier records.",
      },
      {
        key: "money:refunds:view",
        label: "View refunds",
        description: "Can view the refund tracker.",
      },
      {
        key: "money:manage_refunds",
        label: "Manage refunds",
        description: "Can create, update and complete refund records.",
      },
      {
        key: "money:direct_debits:view",
        label: "View direct debits",
        description: "Can view direct debit plans and occurrences.",
      },
      {
        key: "money:direct_debits:manage",
        label: "Manage direct debits",
        description: "Can create, edit and process direct debit plans.",
      },
      {
        key: "money:reconciliation:view",
        label: "View bank reconciliation",
        description: "Can view balance checks and reconciliation records.",
      },
      {
        key: "money:reconciliation:manage",
        label: "Manage bank reconciliation",
        description: "Can record and update bank balance checks.",
      },
      {
        key: "money:saving_targets:manage",
        label: "Manage saving targets",
        description: "Can create and update saving targets.",
      },
      {
        key: "money:csv_import",
        label: "Import bank CSV files",
        description: "Can preview and import bank activity CSV files.",
      },
      {
        key: "money:sync_website_payments",
        label: "Sync website payments",
        description: "Can import live website payment records.",
        dangerous: true,
      },
      {
        key: "money:receipts:manage",
        label: "Manage receipts",
        description: "Can upload, view and link receipt images or files.",
      },
      {
        key: "money:print_reports",
        label: "Print money reports",
        description: "Can print money and reconciliation reports.",
      },
      {
        key: "money:export_reports",
        label: "Export money reports",
        description: "Can export Excel workbooks and finance packs.",
      },
    ],
  },
  {
    title: "Event Hub",
    description:
      "Events, contacts, stallholders, checklists, applications and event audit records.",
    permissions: [
      {
        key: "event_hub:view",
        label: "View Event Hub",
        description: "Can open the Event Hub app.",
      },
      {
        key: "event_hub:events:manage",
        label: "Manage events",
        description: "Can create, edit, activate and archive events.",
      },
      {
        key: "event_hub:contacts:view",
        label: "View event contacts",
        description: "Can view business, stallholder and event contact records.",
      },
      {
        key: "event_hub:contacts:manage",
        label: "Manage event contacts",
        description: "Can add, edit, link and update event contacts.",
      },
      {
        key: "event_hub:checklists:view",
        label: "View event checklists",
        description: "Can view PLI, food hygiene, gas and generator checks.",
      },
      {
        key: "event_hub:checklists:manage",
        label: "Manage event checklists",
        description: "Can update event compliance and checklist records.",
      },
      {
        key: "event_hub:applications:view",
        label: "View applications",
        description: "Can view attraction, stallholder and food applications.",
      },
      {
        key: "event_hub:applications:manage",
        label: "Manage applications",
        description: "Can approve, reject or request more information.",
      },
      {
        key: "event_hub:files:view",
        label: "View event documents",
        description: "Can view uploaded PLI, hygiene and selling images.",
      },
      {
        key: "event_hub:files:manage",
        label: "Manage event documents",
        description: "Can upload, replace and remove event documents.",
      },
      {
        key: "event_hub:email",
        label: "Email event contacts",
        description: "Can open the email composer for selected contacts.",
      },
      {
        key: "event_hub:export",
        label: "Export Event Hub records",
        description: "Can export Event Hub contacts and checklists to Excel.",
      },
      {
        key: "event_audit:view",
        label: "View Event Hub audit logs",
        description: "Can view event-related audit records.",
      },
      {
        key: "event_audit:view_all_events",
        label: "View audit logs for all events",
        description: "Can view audit activity across every event year.",
      },
      {
        key: "event_audit:view_security",
        label: "View security-related event logs",
        description: "Can view security and high-risk event audit records.",
        dangerous: true,
      },
    ],
  },
  {
    title: "Stock Management",
    description:
      "Inventory, movements, locations, low stock, orders and supplier connections.",
    permissions: [
      {
        key: "stock:view",
        label: "View Stock Management",
        description: "Can open the Stock Management app.",
      },
      {
        key: "stock:items:view",
        label: "View inventory",
        description: "Can view stock items and quantities.",
      },
      {
        key: "stock:items:manage",
        label: "Manage inventory items",
        description: "Can add and edit stock items.",
      },
      {
        key: "stock:items:delete",
        label: "Delete stock items",
        description: "Can permanently delete stock items when allowed.",
        dangerous: true,
        mainAdminRecommended: true,
      },
      {
        key: "stock:quantity:adjust",
        label: "Adjust stock quantities",
        description: "Can add, remove or set stock quantities.",
      },
      {
        key: "stock:movements:view",
        label: "View stock movements",
        description: "Can view movement and adjustment history.",
      },
      {
        key: "stock:movements:create",
        label: "Move stock",
        description: "Can move stock between locations.",
      },
      {
        key: "stock:locations:view",
        label: "View stock locations",
        description: "Can view storage locations and totals.",
      },
      {
        key: "stock:locations:manage",
        label: "Manage stock locations",
        description: "Can create and rename stock locations.",
      },
      {
        key: "stock:locations:delete",
        label: "Delete stock locations",
        description: "Can delete empty stock locations.",
        dangerous: true,
        mainAdminRecommended: true,
      },
      {
        key: "stock:low_stock:view",
        label: "View low-stock page",
        description: "Can view low and out-of-stock items.",
      },
      {
        key: "stock:orders:view",
        label: "View stock orders",
        description: "Can view stock purchase orders.",
      },
      {
        key: "stock:orders:manage",
        label: "Manage stock orders",
        description: "Can create, edit and update order records.",
      },
      {
        key: "stock:deliveries:manage",
        label: "Manage deliveries",
        description: "Can record partial, missing or damaged deliveries.",
      },
      {
        key: "stock:suppliers:view",
        label: "View stock suppliers",
        description: "Can view Stock, Event Hub and Money supplier links.",
      },
      {
        key: "stock:suppliers:manage",
        label: "Manage stock suppliers",
        description: "Can edit profiles, connections and supplier ratings.",
      },
      {
        key: "stock:suppliers:override_block",
        label: "Override blocked suppliers",
        description: "Can override a do-not-use supplier warning.",
        dangerous: true,
        mainAdminRecommended: true,
      },
      {
        key: "stock:export",
        label: "Export stock reports",
        description: "Can export styled Excel inventory workbooks.",
      },
      {
        key: "stock:audit:view",
        label: "View stock audit logs",
        description: "Can view Stock Management change records.",
      },
    ],
  },
  {
    title: "Community Art",
    description:
      "Community artwork submissions, moderation and public display controls.",
    permissions: [
      {
        key: "community_art:view",
        label: "View Community Art submissions",
        description: "Can view submitted artwork and artist details.",
      },
      {
        key: "community_art:manage",
        label: "Manage Community Art",
        description: "Can approve, reject, hide and edit submissions.",
      },
      {
        key: "community_art:add",
        label: "Add Community Art",
        description: "Can manually add artwork from the admin page.",
      },
      {
        key: "community_art:files",
        label: "Manage artwork images",
        description: "Can view, upload and replace artwork images.",
      },
    ],
  },
  {
    title: "Donations & Supporters",
    description: "Donations, supporter wall and public donation records.",
    permissions: [
      {
        key: "donations:view",
        label: "View donations",
        description: "Can view donation records and supporter details.",
      },
      {
        key: "donations:manage",
        label: "Manage donations",
        description: "Can approve, edit or hide donation records.",
      },
      {
        key: "donations:export",
        label: "Export donation reports",
        description: "Can export donation and supporter information.",
      },
    ],
  },
  {
    title: "Raffle",
    description: "Raffle entries, payments and winner controls.",
    permissions: [
      {
        key: "raffle:view",
        label: "View raffle",
        description: "Can view raffle entries and statistics.",
      },
      {
        key: "raffle:manage",
        label: "Manage raffle entries",
        description: "Can update and manage raffle records.",
      },
      {
        key: "raffle:draw_winners",
        label: "Draw raffle winners",
        description: "Can run or repeat the official raffle draw.",
        dangerous: true,
      },
    ],
  },
  {
    title: "Website & Content",
    description:
      "Public pages, navigation, visibility, forms, sponsors and website content.",
    permissions: [
      {
        key: "site_pages:view",
        label: "View website page manager",
        description: "Can view public page settings and visibility.",
      },
      {
        key: "site_pages:manage",
        label: "Manage website pages",
        description: "Can update page status, messages and navigation settings.",
      },
      {
        key: "site_pages:hide",
        label: "Hide or relock pages",
        description: "Can hide public pages and use page relock controls.",
        dangerous: true,
      },
      {
        key: "website:sponsors:view",
        label: "View website sponsors",
        description: "Can view sponsor stories and website display settings.",
      },
      {
        key: "website:sponsors:manage",
        label: "Manage website sponsors",
        description: "Can edit sponsor stories, logos and display order.",
      },
      {
        key: "website:forms:view",
        label: "View website form submissions",
        description: "Can view form responses from the public website.",
      },
      {
        key: "website:forms:manage",
        label: "Manage website form submissions",
        description: "Can update and process public form submissions.",
      },
    ],
  },
  {
    title: "Email",
    description: "Admin email tools and contact messaging.",
    permissions: [
      {
        key: "email:view",
        label: "View email tools",
        description: "Can open the Admin Portal email area.",
      },
      {
        key: "email:send",
        label: "Send emails",
        description: "Can send emails from approved Burton Pride accounts.",
        dangerous: true,
      },
      {
        key: "email:templates:manage",
        label: "Manage email templates",
        description: "Can create and update reusable email templates.",
      },
    ],
  },
  {
    title: "Audit & Security",
    description: "Platform audit logs, login activity and security records.",
    permissions: [
      {
        key: "audit_logs:view",
        label: "View platform audit logs",
        description: "Can view Admin Portal audit activity.",
      },
      {
        key: "audit_logs:view_security",
        label: "View security audit logs",
        description: "Can view login, blocked and high-risk audit events.",
        dangerous: true,
      },
      {
        key: "audit_logs:export",
        label: "Export audit logs",
        description: "Can export audit records for review.",
        dangerous: true,
      },
      {
        key: "security:settings:view",
        label: "View security settings",
        description: "Can view account and two-step verification settings.",
      },
      {
        key: "security:settings:manage",
        label: "Manage security settings",
        description: "Can update security and two-step verification controls.",
        dangerous: true,
        mainAdminRecommended: true,
      },
    ],
  },
];

const allPermissionKeys = permissionGroups.flatMap((group) =>
  group.permissions.map((permission) => permission.key),
);

const defaultPermissionsByRole: Record<AdminRole, string[]> = {
  main_admin: allPermissionKeys,
  admin: [
    "admin:dashboard:view",
    "money:view",
    "event_hub:view",
    "stock:view",
    "community_art:view",
    "site_pages:view",
    "audit_logs:view",
  ],
  editor: [
    "admin:dashboard:view",
    "community_art:view",
    "community_art:manage",
    "site_pages:view",
    "site_pages:manage",
    "website:sponsors:view",
    "website:sponsors:manage",
  ],
};

async function readJsonResponse(res: Response): Promise<ApiResult> {
  const text = await res.text();

  try {
    return text ? (JSON.parse(text) as ApiResult) : {};
  } catch {
    return {
      ok: false,
      error: "The server returned an unreadable response.",
    };
  }
}

function buildSafeApiError(data: ApiResult, fallback: string) {
  return data?.error || data?.message || fallback;
}

function normalisePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0),
    ),
  );
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

function formatDate(value: string | null) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminUsersClient() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");
  const [isActive, setIsActive] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    defaultPermissionsByRole.admin,
  );

  const [permissionSearch, setPermissionSearch] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminFilter, setAdminFilter] = useState<AdminFilter>("all");

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Admin Portal": true,
    "Money Management": true,
    "Event Hub": true,
    "Stock Management": true,
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
    [admins],
  );

  const mainAdmins = useMemo(
    () =>
      admins.filter(
        (admin) => admin.role === "main_admin" && admin.is_active,
      ),
    [admins],
  );

  const filteredAdmins = useMemo(() => {
    const search = adminSearch.trim().toLowerCase();

    return admins.filter((admin) => {
      const matchesSearch =
        !search ||
        String(admin.full_name || "").toLowerCase().includes(search) ||
        String(admin.email || "").toLowerCase().includes(search) ||
        String(admin.role || "").toLowerCase().includes(search);

      const matchesFilter =
        adminFilter === "all" ||
        (adminFilter === "active" && admin.is_active) ||
        (adminFilter === "inactive" && !admin.is_active) ||
        admin.role === adminFilter;

      return matchesSearch && matchesFilter;
    });
  }, [admins, adminFilter, adminSearch]);

  async function loadAdmins() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const res = await fetch(`/api/admin/settings/users?t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(
          buildSafeApiError(data, "Failed to load admin users."),
        );
      }

      const nextAdmins = (data.admins || []).map((admin) => ({
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
          : "Something went wrong while loading admin users.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdmins();
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

    setSelectedPermissions((prev) =>
      prev.includes(permissionKey)
        ? prev.filter((item) => item !== permissionKey)
        : [...prev, permissionKey],
    );
  }

  function toggleDraftPermission(adminId: string, permissionKey: string) {
    const admin = admins.find((item) => item.id === adminId);

    if (!admin || admin.role === "main_admin") return;

    setDraftPermissions((prev) => {
      const existing = prev[adminId] || [];

      return {
        ...prev,
        [adminId]: existing.includes(permissionKey)
          ? existing.filter((item) => item !== permissionKey)
          : [...existing, permissionKey],
      };
    });
  }

  function selectWholeGroup(
    group: PermissionGroup,
    current: string[],
    onChange: (next: string[]) => void,
  ) {
    const groupKeys = group.permissions.map((item) => item.key);
    const allSelected = groupKeys.every((key) => current.includes(key));

    if (allSelected) {
      onChange(current.filter((key) => !groupKeys.includes(key)));
      return;
    }

    onChange(Array.from(new Set([...current, ...groupKeys])));
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

  async function addOrUpdateAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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

      const res = await fetch("/api/admin/settings/users", {
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
            role === "main_admin"
              ? allPermissionKeys
              : selectedPermissions,
          twoFactorRequired: true,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(
          buildSafeApiError(data, "Failed to save admin user."),
        );
      }

      setMessage(data.message || "Admin user saved successfully.");
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
          : "Something went wrong while saving the admin user.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateAdmin(
    admin: AdminUser,
    nextValues: Partial<AdminUser>,
    nextPermissions?: string[],
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

      const res = await fetch("/api/admin/settings/users", {
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
          twoFactorRequired: true,
        }),
      });

      const data = await readJsonResponse(res);

      if (!res.ok || !data.ok) {
        throw new Error(
          buildSafeApiError(data, "Failed to update admin user."),
        );
      }

      setMessage(data.message || "Admin user updated successfully.");
      await loadAdmins();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while updating the admin user.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function saveAdminPermissions(admin: AdminUser) {
    const permissionsToSave =
      admin.role === "main_admin"
        ? allPermissionKeys
        : draftPermissions[admin.id] ||
          normalisePermissions(admin.permissions);

    await updateAdmin(admin, {}, permissionsToSave);
    setExpandedAdminId(null);
  }

  function renderPermissionGroups(args: {
    roleValue: AdminRole;
    permissions: string[];
    disabled?: boolean;
    onToggle: (permissionKey: string) => void;
    onReplace?: (permissions: string[]) => void;
  }) {
    if (args.roleValue === "main_admin") {
      return (
        <div className="rounded-2xl border border-purple-300/25 bg-purple-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-purple-300/25 bg-purple-500/20 p-2 text-purple-100">
              <ShieldCheck className="h-4 w-4" />
            </div>

            <div>
              <p className="text-sm font-black text-white">
                Main admins receive every permission automatically
              </p>
              <p className="mt-1 text-xs leading-5 text-white/55">
                Main admins can access every current and future Admin Portal
                feature, including high-risk actions.
              </p>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-purple-100">
                {allPermissionKeys.length} permissions included
              </div>
            </div>
          </div>
        </div>
      );
    }

    const search = permissionSearch.trim().toLowerCase();

    const visibleGroups = permissionGroups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => {
          if (!search) return true;

          return (
            permission.label.toLowerCase().includes(search) ||
            permission.description.toLowerCase().includes(search) ||
            permission.key.toLowerCase().includes(search) ||
            group.title.toLowerCase().includes(search)
          );
        }),
      }))
      .filter((group) => group.permissions.length > 0);

    return (
      <div className="space-y-3">
        {visibleGroups.map((group) => {
          const isOpen = openGroups[group.title] !== false;
          const groupKeys = group.permissions.map((permission) => permission.key);
          const enabledInGroup = groupKeys.filter((key) =>
            args.permissions.includes(key),
          ).length;
          const allInGroupEnabled =
            groupKeys.length > 0 &&
            groupKeys.every((key) => args.permissions.includes(key));

          return (
            <div
              key={group.title}
              className="rounded-2xl border border-white/10 bg-black/20"
            >
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-black text-white">{group.title}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {group.description}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-purple-100/70">
                    {enabledInGroup} of {groupKeys.length} enabled
                  </p>
                </button>

                <div className="flex items-center gap-2">
                  {args.onReplace ? (
                    <button
                      type="button"
                      disabled={args.disabled}
                      onClick={() =>
                        selectWholeGroup(
                          group,
                          args.permissions,
                          args.onReplace!,
                        )
                      }
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {allInGroupEnabled ? "Clear" : "Select all"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className="rounded-lg p-1.5 text-white/60 hover:bg-white/10"
                    aria-label={`${isOpen ? "Close" : "Open"} ${group.title}`}
                  >
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="space-y-2 border-t border-white/10 p-3">
                  {group.permissions.map((permission) => {
                    const checked = args.permissions.includes(permission.key);

                    return (
                      <label
                        key={permission.key}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                          checked
                            ? "border-sky-300/25 bg-sky-500/10"
                            : permission.dangerous
                              ? "border-amber-300/15 bg-amber-500/[0.05] hover:bg-amber-500/[0.08]"
                              : "border-white/10 bg-black/20 hover:bg-white/5"
                        } ${args.disabled ? "cursor-not-allowed opacity-70" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={args.disabled}
                          onChange={() => args.onToggle(permission.key)}
                          className="mt-1"
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-white">
                              {permission.label}
                            </p>

                            {permission.dangerous ? (
                              <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100">
                                High risk
                              </span>
                            ) : null}

                            {permission.mainAdminRecommended ? (
                              <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-purple-100">
                                Main admin recommended
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 text-xs leading-5 text-white/45">
                            {permission.description}
                          </p>

                          <p className="mt-1 break-all font-mono text-[10px] text-white/25">
                            {permission.key}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}

        {visibleGroups.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center text-sm text-white/50">
            No permissions match your search.
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full bg-transparent px-3 py-5 text-white sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <section className="rounded-3xl border border-white/15 bg-[#0b0b1f]/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
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

              <p className="mt-3 max-w-4xl text-sm leading-6 text-white/65">
                Manage access across Money Management, Event Hub, Stock
                Management, Community Art, website tools, email, donations,
                applications, audit logs and security settings.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadAdmins()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Admins" value={admins.length} tone="white" />
            <StatCard
              label="Active Admins"
              value={activeAdmins.length}
              tone="emerald"
            />
            <StatCard
              label="Main Admins"
              value={mainAdmins.length}
              tone="purple"
            />
            <StatCard
              label="Available Permissions"
              value={allPermissionKeys.length}
              tone="sky"
            />
          </div>
        </section>

        {message || error ? (
          <section
            role={error ? "alert" : "status"}
            className={`rounded-3xl border p-4 text-sm font-semibold backdrop-blur-xl ${
              error
                ? "border-red-400/30 bg-red-500/10 text-red-100"
                : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            <div className="flex gap-3">
              {error ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              )}

              <span>{error || message}</span>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[520px_minmax(0,1fr)]">
          <form
            onSubmit={addOrUpdateAdmin}
            className="h-fit rounded-3xl border border-white/15 bg-[#0b0b1f]/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-100">
                <UserPlus className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-xl font-black text-white">Add Admin</h2>
                <p className="text-sm text-white/55">
                  Add an approved user and choose exactly what they can access.
                </p>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-bold text-white/70">
                Email address
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                placeholder="name@burtonpride.co.uk"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-300/40"
              />
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-bold text-white/70">
                Display name
              </span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                type="text"
                autoComplete="name"
                placeholder="Full name"
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
              <div className="mb-3">
                <p className="text-sm font-bold text-white/70">
                  Admin Portal permissions
                </p>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  {role === "main_admin"
                    ? "Main admin permissions are included automatically."
                    : "Select only the pages and actions this admin needs."}
                </p>
              </div>

              {role !== "main_admin" ? (
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={permissionSearch}
                    onChange={(event) =>
                      setPermissionSearch(event.target.value)
                    }
                    placeholder="Search permissions..."
                    className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-10 pr-10 text-sm text-white outline-none placeholder:text-white/30 focus:border-purple-300/40"
                  />

                  {permissionSearch ? (
                    <button
                      type="button"
                      onClick={() => setPermissionSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white"
                      aria-label="Clear permission search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              {renderPermissionGroups({
                roleValue: role,
                permissions: selectedPermissions,
                onToggle: toggleSelectedPermission,
                onReplace: setSelectedPermissions,
              })}
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />

              <div>
                <p className="text-sm font-bold text-white">Active admin</p>
                <p className="text-xs text-white/50">
                  Inactive admins cannot access the Admin Portal.
                </p>
              </div>
            </label>

            <div className="mt-5 rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-100" />
                <div>
                  <p className="text-sm font-black text-white">
                    Two-step verification required
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/55">
                    New admin accounts are saved with two-step verification
                    required.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-purple-950/30 hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Saving..." : "Save Admin"}
            </button>
          </form>

          <section className="min-w-0 rounded-3xl border border-white/15 bg-[#0b0b1f]/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-100">
                  <UserCog className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-xl font-black text-white">
                    Current Admin Users
                  </h2>
                  <p className="text-sm text-white/55">
                    Search, filter and manage access.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] lg:w-[520px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={adminSearch}
                    onChange={(event) => setAdminSearch(event.target.value)}
                    placeholder="Search admins..."
                    className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/30"
                  />
                </div>

                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <select
                    value={adminFilter}
                    onChange={(event) =>
                      setAdminFilter(event.target.value as AdminFilter)
                    }
                    className="w-full appearance-none rounded-2xl border border-white/10 bg-black/30 py-3 pl-10 pr-4 text-sm text-white outline-none"
                  >
                    <option value="all">All admins</option>
                    <option value="active">Active only</option>
                    <option value="inactive">Inactive only</option>
                    <option value="main_admin">Main admins</option>
                    <option value="admin">Admins</option>
                    <option value="editor">Editors</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-white/60">
                <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                Loading admin users...
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-white/60">
                No admin users match the current search or filter.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {filteredAdmins.map((admin) => {
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
                                admin.role,
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

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                                admin.two_factor_enabled
                                  ? "border-blue-300/30 bg-blue-500/10 text-blue-100"
                                  : "border-amber-300/30 bg-amber-500/10 text-amber-100"
                              }`}
                            >
                              {admin.two_factor_enabled
                                ? `2FA: ${
                                    admin.two_factor_method || "enabled"
                                  }`
                                : "2FA setup required"}
                            </span>
                          </div>

                          <p className="mt-3 break-words text-base font-black text-white">
                            {admin.full_name ||
                              admin.email ||
                              "No name saved"}
                          </p>

                          <p className="mt-1 break-words text-sm text-white/55">
                            {admin.email || "No email saved"}
                          </p>

                          <div className="mt-3 grid gap-1 text-xs text-white/35">
                            <p>
                              Supabase user ID:{" "}
                              {admin.supabase_user_id || "Not linked yet"}
                            </p>
                            <p>Added: {formatDate(admin.created_at)}</p>
                            <p>Updated: {formatDate(admin.updated_at)}</p>
                          </div>
                        </div>

                        <div className="flex w-full flex-col gap-3 2xl:w-[300px]">
                          <label>
                            <span className="text-xs font-bold text-white/50">
                              Role
                            </span>
                            <select
                              value={admin.role}
                              disabled={updatingId === admin.id}
                              onChange={(event) =>
                                void updateAdmin(
                                  admin,
                                  {
                                    role: event.target.value as AdminRole,
                                  },
                                  defaultPermissionsByRole[
                                    event.target.value as AdminRole
                                  ],
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
                              void updateAdmin(admin, {
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
                                ? "Main admins automatically have every permission."
                                : `${permissionCount(
                                    admin.role,
                                    admin.permissions,
                                  )} permissions enabled.`}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => startEditPermissions(admin)}
                            className="inline-flex items-center justify-center rounded-xl border border-purple-300/20 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-100 hover:bg-purple-500/20"
                          >
                            {expandedAdminId === admin.id
                              ? "Close permissions"
                              : admin.role === "main_admin"
                                ? "View permissions"
                                : "Manage permissions"}
                          </button>
                        </div>

                        {expandedAdminId === admin.id ? (
                          <div className="mt-4 space-y-4">
                            {admin.role !== "main_admin" ? (
                              <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                                <input
                                  value={permissionSearch}
                                  onChange={(event) =>
                                    setPermissionSearch(event.target.value)
                                  }
                                  placeholder="Search permissions..."
                                  className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/30"
                                />
                              </div>
                            ) : null}

                            {renderPermissionGroups({
                              roleValue: admin.role,
                              permissions: adminPermissions,
                              onToggle: (permissionKey) =>
                                toggleDraftPermission(
                                  admin.id,
                                  permissionKey,
                                ),
                              onReplace:
                                admin.role === "main_admin"
                                  ? undefined
                                  : (permissions) =>
                                      setDraftPermissions((prev) => ({
                                        ...prev,
                                        [admin.id]: permissions,
                                      })),
                            })}

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                              <button
                                type="button"
                                onClick={() => setExpandedAdminId(null)}
                                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
                              >
                                Close
                              </button>

                              {admin.role !== "main_admin" ? (
                                <button
                                  type="button"
                                  disabled={updatingId === admin.id}
                                  onClick={() =>
                                    void saveAdminPermissions(admin)
                                  }
                                  className="rounded-xl bg-purple-500 px-4 py-2 text-xs font-black text-white hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updatingId === admin.id
                                    ? "Saving..."
                                    : "Save permissions"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
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

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "white" | "emerald" | "purple" | "sky";
}) {
  const classes = {
    white: "border-white/10 bg-black/20 text-white",
    emerald:
      "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
    purple:
      "border-purple-300/20 bg-purple-500/10 text-purple-100",
    sky: "border-sky-300/20 bg-sky-500/10 text-sky-100",
  };

  return (
    <div className={`rounded-2xl border p-4 ${classes[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
