"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AdminUser = {
  id: string;
  email: string;
  full_name?: string | null;
  role?: string | null;
  is_main_admin?: boolean | null;
};

type AdminContextValue = {
  admin: AdminUser | null;
  loading: boolean;
  error: string | null;
  refreshAdmin: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshAdmin() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/admin/me", {
        cache: "no-store",
        credentials: "include",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.error || json?.message || "Failed to load admin user."
        );
      }

      setAdmin(json?.admin || json?.user || null);
    } catch (err: any) {
      setAdmin(null);
      setError(err?.message || "Failed to load admin user.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAdmin();
  }, []);

  const value = useMemo<AdminContextValue>(
    () => ({
      admin,
      loading,
      error,
      refreshAdmin,
    }),
    [admin, loading, error]
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