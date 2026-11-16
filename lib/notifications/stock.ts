export const stockNotificationCategories = {
  item_changed: "Stock items created and changed",
  low_stock: "Items entering low stock",
  out_of_stock: "Items reaching zero stock",
  movement_recorded: "Recorded stock movements",
  order_changed: "Purchase and supplier-order changes",
  delivery_received: "Recorded deliveries and receipts",
  delivery_issue: "Delivery problems and supplier review flags",
  supplier_changed: "Suppliers and item-supplier links",
  location_changed: "Stock location changes",
  document_added: "Order documents uploaded",
} as const;
export const stockNotificationSettingsApi =
  "/api/admin/notifications/stock-preferences";
export const stockNotificationSettingsPath =
  "/Admin/Dashboard/Notifications/Stock";
