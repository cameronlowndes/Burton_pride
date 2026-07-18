// types/stock-management.ts

export type StockAdmin = {
  id: string;
  name: string;
  email: string;
  role: string;
  isMainAdmin: boolean;
};

export type StockManagementContextValue = {
  admin: StockAdmin | null;
  loadingAdmin: boolean;
  adminError: string | null;
  refreshAdmin: () => Promise<void>;
};