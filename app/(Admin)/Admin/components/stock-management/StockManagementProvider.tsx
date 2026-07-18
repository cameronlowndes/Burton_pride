// components/stock-management/StockManagementProvider.tsx

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  StockAdmin,
  StockManagementContextValue,
} from "@/types/stock-management";

const StockManagementContext =
  createContext<StockManagementContextValue | null>(null);

function normaliseAdmin(data: unknown): StockAdmin | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const value = data as Record<string, unknown>;

  const adminData =
    value.admin && typeof value.admin === "object"
      ? (value.admin as Record<string, unknown>)
      : value;

  const id = String(
    adminData.id ??
      adminData.admin_id ??
      adminData.user_id ??
      "",
  ).trim();

  const email = String(adminData.email ?? "").trim();

  const firstName = String(
    adminData.first_name ?? adminData.firstName ?? "",
  ).trim();

  const lastName = String(
    adminData.last_name ?? adminData.lastName ?? "",
  ).trim();

  const suppliedName = String(
    adminData.name ??
      adminData.full_name ??
      adminData.display_name ??
      "",
  ).trim();

  const name =
    suppliedName ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    email ||
    "Administrator";

  const role = String(adminData.role ?? "admin").trim();

  if (!id || !email) {
    return null;
  }

  return {
    id,
    name,
    email,
    role,
    isMainAdmin:
      adminData.is_main_admin === true ||
      adminData.isMainAdmin === true ||
      role === "main_admin",
  };
}

export default function StockManagementProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [admin, setAdmin] = useState<StockAdmin | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);

  const refreshAdmin = useCallback(async () => {
    setLoadingAdmin(true);
    setAdminError(null);

    try {
      const response = await fetch("/api/admin/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        setAdmin(null);
        setAdminError("Your admin session has expired.");
        return;
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Unable to load the signed-in administrator.";

        throw new Error(message);
      }

      const currentAdmin = normaliseAdmin(data);

      if (!currentAdmin) {
        throw new Error(
          "The admin account returned by the server is incomplete.",
        );
      }

      setAdmin(currentAdmin);
    } catch (error) {
      console.error("Failed to load Stock Control admin:", error);

      setAdmin(null);
      setAdminError(
        error instanceof Error
          ? error.message
          : "Unable to load the signed-in administrator.",
      );
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  useEffect(() => {
    void refreshAdmin();
  }, [refreshAdmin]);

  const value = useMemo<StockManagementContextValue>(
    () => ({
      admin,
      loadingAdmin,
      adminError,
      refreshAdmin,
    }),
    [admin, loadingAdmin, adminError, refreshAdmin],
  );

  return (
    <StockManagementContext.Provider value={value}>
      {children}
    </StockManagementContext.Provider>
  );
}

export function useStockManagement() {
  const context = useContext(StockManagementContext);

  if (!context) {
    throw new Error(
      "useStockManagement must be used inside StockManagementProvider.",
    );
  }

  return context;
}