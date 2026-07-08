"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type AdminRole = "main_admin" | "admin" | "editor";

export type AdminStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

export type AdminUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role?: AdminRole | null;
  is_main_admin?: boolean | null;
  permissions?: string[] | null;

  /**
   * Allows your /api/admin/me route to return extra admin fields
   * without breaking the context type.
   */
  [key: string]: unknown;
};

type AdminErrorDetails = {
  message: string;
  status?: number | null;
  code?: string | null;
};

type AdminContextValue = {
  /**
   * Old values kept so your existing pages do not break.
   */
  admin: AdminUser | null;
  loading: boolean;
  error: string | null;
  refreshAdmin: () => Promise<void>;

  /**
   * New stronger admin state.
   */
  status: AdminStatus;
  refreshing: boolean;
  isAuthenticated: boolean;
  isUnauthenticated: boolean;
  errorDetails: AdminErrorDetails | null;
  errorStatus: number | null;
  lastLoadedAt: string | null;

  /**
   * Handy display values for sidebars and layouts.
   */
  adminName: string;
  adminEmail: string;
  adminRole: AdminRole | null;
  permissions: string[];
  isMainAdmin: boolean;

  /**
   * Permission helpers.
   */
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissionsToCheck: string[]) => boolean;
  hasAllPermissions: (permissionsToCheck: string[]) => boolean;

  /**
   * Useful after logout or when forcing a local reset.
   */
  clearAdmin: () => void;
};

type UnknownRecord = Record<string, unknown>;

const AdminContext = createContext<AdminContextValue | null>(null);

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getMessageFromJson(json: unknown) {
  if (!isRecord(json)) return "";

  const error = getString(json.error);
  const message = getString(json.message);
  const rawResponse = getString(json.rawResponse);

  return error || message || rawResponse;
}

function normaliseRole(value: unknown): AdminRole | null {
  const role = getString(value).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");

  if (role === "main_admin" || role === "mainadmin" || role === "owner") {
    return "main_admin";
  }

  if (role === "admin") return "admin";
  if (role === "editor") return "editor";

  return null;
}

function normalisePermissionList(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => getString(item))
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );
  }

  if (isRecord(value)) {
    return Array.from(
      new Set(
        Object.entries(value)
          .filter(([, allowed]) => {
            return (
              allowed === true ||
              allowed === "true" ||
              allowed === 1 ||
              allowed === "1"
            );
          })
          .map(([permission]) => permission.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
}

function extractResponseData(json: unknown): UnknownRecord | null {
  if (!isRecord(json)) return null;

  if (isRecord(json.data)) return json.data;

  return null;
}

function extractRawAdmin(json: unknown): UnknownRecord | null {
  if (!isRecord(json)) return null;

  const data = extractResponseData(json);

  const candidates = [
    json.admin,
    json.user,
    data?.admin,
    data?.user,
    data,
  ];

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;

    const email = getString(candidate.email);
    const id = getString(candidate.id);

    if (email || id) return candidate;
  }

  return null;
}

function extractPermissions(json: unknown, rawAdmin: UnknownRecord | null) {
  if (!isRecord(json)) return [];

  const data = extractResponseData(json);

  const candidates = [
    json.permissions,
    rawAdmin?.permissions,
    data?.permissions,
    isRecord(data?.admin) ? data.admin.permissions : null,
    isRecord(data?.user) ? data.user.permissions : null,
  ];

  for (const candidate of candidates) {
    const permissions = normalisePermissionList(candidate);

    if (permissions.length > 0) return permissions;
  }

  return [];
}

function normaliseAdminFromResponse(json: unknown): AdminUser | null {
  const rawAdmin = extractRawAdmin(json);

  if (!rawAdmin) return null;

  const id = getString(rawAdmin.id);
  const email = getString(rawAdmin.email).toLowerCase();

  if (!id && !email) return null;

  const role = normaliseRole(rawAdmin.role);
  const permissions = extractPermissions(json, rawAdmin);

  const isMainAdmin =
    rawAdmin.is_main_admin === true ||
    rawAdmin.isMainAdmin === true ||
    role === "main_admin";

  const fullName =
    getString(rawAdmin.full_name) ||
    getString(rawAdmin.fullName) ||
    getString(rawAdmin.name) ||
    null;

  return {
    ...rawAdmin,
    id,
    email,
    full_name: fullName,
    role,
    is_main_admin: isMainAdmin,
    permissions,
  } as AdminUser;
}

async function readAdminJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      rawResponse: text,
      error: "The admin session API returned invalid JSON.",
    };
  }
}

function buildAdminError(args: {
  message: string;
  status?: number | null;
  code?: string | null;
}): AdminErrorDetails {
  return {
    message: args.message,
    status: args.status ?? null,
    code: args.code ?? null,
  };
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const activeControllerRef = useRef<AbortController | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<AdminStatus>("loading");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorDetails, setErrorDetails] = useState<AdminErrorDetails | null>(
    null
  );
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const clearAdmin = useCallback(() => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;

    setAdmin(null);
    setStatus("unauthenticated");
    setLoading(false);
    setRefreshing(false);
    setErrorDetails(null);
    setLastLoadedAt(new Date().toISOString());
  }, []);

  const refreshAdmin = useCallback(async () => {
    activeControllerRef.current?.abort();

    const controller = new AbortController();
    activeControllerRef.current = controller;

    const isInitialLoad = !hasLoadedOnceRef.current;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setErrorDetails(null);

    try {
      const response = await fetch("/api/admin/me", {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      const json = await readAdminJson(response);

      if (controller.signal.aborted) return;

      if (response.status === 401) {
        setAdmin(null);
        setStatus("unauthenticated");
        setErrorDetails(null);
        return;
      }

      if (!response.ok) {
        const message =
          getMessageFromJson(json) ||
          `Failed to load admin user. HTTP ${response.status}`;

        setAdmin(null);
        setStatus("error");
        setErrorDetails(
          buildAdminError({
            message,
            status: response.status,
          })
        );
        return;
      }

      if (isRecord(json) && json.ok === false) {
        const message =
          getMessageFromJson(json) || "Failed to load admin user.";

        setAdmin(null);
        setStatus("error");
        setErrorDetails(
          buildAdminError({
            message,
            status: response.status,
          })
        );
        return;
      }

      const nextAdmin = normaliseAdminFromResponse(json);

      if (!nextAdmin) {
        setAdmin(null);
        setStatus("unauthenticated");
        setErrorDetails(null);
        return;
      }

      setAdmin(nextAdmin);
      setStatus("authenticated");
      setErrorDetails(null);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      const message =
        err instanceof Error ? err.message : "Failed to load admin user.";

      setAdmin(null);
      setStatus("error");
      setErrorDetails(
        buildAdminError({
          message,
          status: null,
        })
      );
    } finally {
      if (!controller.signal.aborted) {
        hasLoadedOnceRef.current = true;
        setLastLoadedAt(new Date().toISOString());
        setLoading(false);
        setRefreshing(false);
      }

      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void refreshAdmin();

    return () => {
      activeControllerRef.current?.abort();
      activeControllerRef.current = null;
    };
  }, [refreshAdmin]);

  const permissions = useMemo(() => {
    return normalisePermissionList(admin?.permissions);
  }, [admin?.permissions]);

  const adminRole = useMemo(() => {
    return normaliseRole(admin?.role);
  }, [admin?.role]);

  const isMainAdmin = useMemo(() => {
    return admin?.is_main_admin === true || adminRole === "main_admin";
  }, [admin?.is_main_admin, adminRole]);

  const adminEmail = admin?.email || "";

  const adminName = useMemo(() => {
    const fullName = getString(admin?.full_name);

    if (fullName) return fullName;

    if (adminEmail) {
      const beforeAt = adminEmail.split("@")[0] || "Admin";
      return beforeAt
        .split(/[._-]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }

    return "Admin";
  }, [admin?.full_name, adminEmail]);

  const hasPermission = useCallback(
    (permission: string) => {
      const cleanPermission = permission.trim();

      if (!cleanPermission) return false;
      if (isMainAdmin) return true;

      return permissions.includes(cleanPermission);
    },
    [isMainAdmin, permissions]
  );

  const hasAnyPermission = useCallback(
    (permissionsToCheck: string[]) => {
      if (isMainAdmin) return true;

      return permissionsToCheck.some((permission) =>
        hasPermission(permission)
      );
    },
    [hasPermission, isMainAdmin]
  );

  const hasAllPermissions = useCallback(
    (permissionsToCheck: string[]) => {
      if (isMainAdmin) return true;

      return permissionsToCheck.every((permission) =>
        hasPermission(permission)
      );
    },
    [hasPermission, isMainAdmin]
  );

  const value = useMemo<AdminContextValue>(
    () => ({
      admin,
      loading,
      error: errorDetails?.message || null,
      refreshAdmin,

      status,
      refreshing,
      isAuthenticated: status === "authenticated",
      isUnauthenticated: status === "unauthenticated",
      errorDetails,
      errorStatus: errorDetails?.status ?? null,
      lastLoadedAt,

      adminName,
      adminEmail,
      adminRole,
      permissions,
      isMainAdmin,

      hasPermission,
      hasAnyPermission,
      hasAllPermissions,

      clearAdmin,
    }),
    [
      admin,
      loading,
      errorDetails,
      refreshAdmin,
      status,
      refreshing,
      lastLoadedAt,
      adminName,
      adminEmail,
      adminRole,
      permissions,
      isMainAdmin,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      clearAdmin,
    ]
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);

  if (!context) {
    throw new Error("useAdmin must be used inside AdminProvider.");
  }

  return context;
}

export function useOptionalAdmin() {
  return useContext(AdminContext);
}
