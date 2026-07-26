import type {
  StockOrder,
  StockOrderLine,
  StockOrderStatus,
} from "./types";

type OrderRow = Record<string, unknown>;
type OrderLineRow = Record<string, unknown>;

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapOrderLine(row: OrderLineRow): StockOrderLine {
  return {
    id: String(row.id || ""),
    orderId: String(row.order_id || ""),
    stockItemId: row.stock_item_id ? String(row.stock_item_id) : null,
    itemName: String(row.item_name || "Unnamed item"),
    sku: row.sku ? String(row.sku) : null,
    quantityOrdered: numberValue(row.quantity_ordered),
    quantityReceived: numberValue(row.quantity_received),
    estimatedUnitCost: nullableNumber(row.estimated_unit_cost),
    actualUnitCost: nullableNumber(row.actual_unit_cost),
    destinationLocationId: row.destination_location_id
      ? String(row.destination_location_id)
      : null,
    destinationLocationName:
      row.destination_location_name
        ? String(row.destination_location_name)
        : null,
    notes: row.notes ? String(row.notes) : null,
  };
}

export function mapOrder(
  row: OrderRow,
  lines: StockOrderLine[] = [],
): StockOrder {
  return {
    id: String(row.id || ""),
    orderNumber: String(row.order_number || ""),
    title: String(row.title || ""),
    supplierId: row.supplier_id ? String(row.supplier_id) : null,
    supplierName: row.supplier_name ? String(row.supplier_name) : null,
    supplierReference: row.supplier_reference
      ? String(row.supplier_reference)
      : null,
    status: String(row.status || "draft") as StockOrderStatus,
    moneyBudgetId: row.money_budget_id
      ? String(row.money_budget_id)
      : null,
    moneyTransactionId: row.money_transaction_id
      ? String(row.money_transaction_id)
      : null,
    moneySupplierId: row.money_supplier_id
      ? String(row.money_supplier_id)
      : null,
    estimatedSubtotal: numberValue(row.estimated_subtotal),
    estimatedDelivery: numberValue(row.estimated_delivery),
    estimatedVat: numberValue(row.estimated_vat),
    estimatedDiscount: numberValue(row.estimated_discount),
    estimatedTotal: numberValue(row.estimated_total),
    actualSubtotal: nullableNumber(row.actual_subtotal),
    actualDelivery: nullableNumber(row.actual_delivery),
    actualVat: nullableNumber(row.actual_vat),
    actualDiscount: nullableNumber(row.actual_discount),
    actualTotal: nullableNumber(row.actual_total),
    orderDate: row.order_date ? String(row.order_date) : null,
    expectedDeliveryDate: row.expected_delivery_date
      ? String(row.expected_delivery_date)
      : null,
    receivedDate: row.received_date ? String(row.received_date) : null,
    supplierOrderNumber: row.supplier_order_number
      ? String(row.supplier_order_number)
      : null,
    invoiceNumber: row.invoice_number
      ? String(row.invoice_number)
      : null,
    reason: row.reason ? String(row.reason) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at || ""),
    createdByName: row.created_by_name
      ? String(row.created_by_name)
      : null,
    updatedAt: String(row.updated_at || ""),
    updatedByName: row.updated_by_name
      ? String(row.updated_by_name)
      : null,
    lines,
  };
}

export function calculateOrderTotals(lines: Array<{
  quantityOrdered: number;
  estimatedUnitCost: number | null;
}>, delivery = 0, vat = 0, discount = 0) {
  const subtotal = lines.reduce(
    (total, line) =>
      total +
      line.quantityOrdered * Number(line.estimatedUnitCost || 0),
    0,
  );

  const total = subtotal + delivery + vat - discount;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    delivery: Number(delivery.toFixed(2)),
    vat: Number(vat.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    total: Number(Math.max(total, 0).toFixed(2)),
  };
}

export function createOrderNumber(sequence: number) {
  const year = new Date().getFullYear();
  return `BP-ORD-${year}-${String(sequence).padStart(4, "0")}`;
}
