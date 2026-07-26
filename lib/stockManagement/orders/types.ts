export type StockOrderStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export type StockOrderLine = {
  id: string;
  orderId: string;
  stockItemId: string | null;
  itemName: string;
  sku: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  estimatedUnitCost: number | null;
  actualUnitCost: number | null;
  destinationLocationId: string | null;
  destinationLocationName?: string | null;
  notes: string | null;
};

export type StockOrder = {
  id: string;
  orderNumber: string;
  title: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierReference: string | null;
  status: StockOrderStatus;
  moneyBudgetId: string | null;
  moneyTransactionId: string | null;
  moneySupplierId: string | null;
  estimatedSubtotal: number;
  estimatedDelivery: number;
  estimatedVat: number;
  estimatedDiscount: number;
  estimatedTotal: number;
  actualSubtotal: number | null;
  actualDelivery: number | null;
  actualVat: number | null;
  actualDiscount: number | null;
  actualTotal: number | null;
  orderDate: string | null;
  expectedDeliveryDate: string | null;
  receivedDate: string | null;
  supplierOrderNumber: string | null;
  invoiceNumber: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  updatedByName: string | null;
  lines: StockOrderLine[];
};

export type StockOrderSummary = {
  draft: number;
  awaitingApproval: number;
  approved: number;
  ordered: number;
  partiallyReceived: number;
  overdue: number;
  outstandingEstimatedCost: number;
};

export type StockOrderListResponse = {
  ok: boolean;
  orders: StockOrder[];
  summary: StockOrderSummary;
  error?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};
