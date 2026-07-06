"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AdminRole = "main_admin" | "admin" | "editor" | string;

export type AdminUser = {
  id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  permissions?: Record<string, boolean>;
  name?: string | null;
};

type AdminContextValue = {
  admin: AdminUser | null;
  loading: boolean;
  error: string | null;
  refreshAdmin: () => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
  isMainAdmin: boolean;
};

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

function normalizeAdminResponse(data: any): AdminUser | null {
  const admin =
    data?.admin ??
    data?.adminUser ??
    data?.user ??
    data?.data?.admin ??
    data?.data?.adminUser ??
    null;

  if (!admin) return null;

  return {
    id: String(admin.id ?? ""),
    email: String(admin.email ?? ""),
    role: String(admin.role ?? "editor"),
    is_active: Boolean(admin.is_active ?? admin.isActive ?? true),
    permissions:
      admin.permissions && typeof admin.permissions === "object"
        ? admin.permissions
        : data?.permissions && typeof data.permissions === "object"
          ? data.permissions
          : {},
    name: admin.name ?? admin.full_name ?? null,
  };
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAdmin = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (response.status === 401) {
        setAdmin(null);
        setError("You are not logged in as an admin.");
        return;
      }

      if (response.status === 403) {
        setAdmin(null);
        setError("Your account does not have admin access.");
        return;
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setAdmin(null);
        setError(
          data?.error ||
            data?.message ||
            `Failed to load admin account. Status: ${response.status}`
        );
        return;
      }

      const normalizedAdmin = normalizeAdminResponse(data);

      if (!normalizedAdmin) {
        setAdmin(null);
        setError("Admin account could not be found.");
        return;
      }

      if (!normalizedAdmin.is_active) {
        setAdmin(null);
        setError("Your admin account is not active.");
        return;
      }

      setAdmin(normalizedAdmin);
    } catch (err) {
      console.error("AdminContext error:", err);
      setAdmin(null);
      setError("Unable to load admin account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAdmin();
  }, [refreshAdmin]);

  const hasPermission = useCallback(
    (permissionKey: string) => {
      if (!admin) return false;

      if (admin.role === "main_admin") {
        return true;
      }

      return Boolean(admin.permissions?.[permissionKey]);
    },
    [admin]
  );

  const value = useMemo<AdminContextValue>(
    () => ({
      admin,
      loading,
      error,
      refreshAdmin,
      hasPermission,
      isMainAdmin: admin?.role === "main_admin",
    }),
    [admin, loading, error, refreshAdmin, hasPermission]
  );

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);

  if (!context) {
    throw new Error("useAdmin must be used inside AdminProvider.");
  }

  return context;
}