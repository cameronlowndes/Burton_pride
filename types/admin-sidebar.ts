export type AdminSidebarItem = {
  id: string;
  label: string;
  href: string | null;
  item_type: "link" | "group";
  parent_id: string | null;
  sort_order: number;
  is_enabled: boolean;
  open_in_new_tab: boolean;
  icon?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminSidebarResponse = {
  ok: boolean;
  error?: string;
  items?: AdminSidebarItem[];
  item?: AdminSidebarItem;
};