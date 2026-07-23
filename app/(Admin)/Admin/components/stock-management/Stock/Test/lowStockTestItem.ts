export type LowStockTestPayload = {
  name: string;
  sku: string;
  barcode: null;
  description: string;
  category: string;
  location: string | null;
  supplier: string;
  quantity: number;
  reorderLevel: number;
  targetLevel: number;
  unitCost: number;
  salePrice: null;
  isActive: true;
};

function testReference() {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`.toUpperCase();
}

export function createLowStockTestPayload(params?: {
  locationName?: string | null;
}): LowStockTestPayload {
  const reference = testReference();

  return {
    name: `TEST Low Stock Item ${reference}`,
    sku: `TEST-LOW-${reference}`,
    barcode: null,
    description:
      "Test item created from the Low Stock page. This can be safely deleted after testing.",
    category: "TEST ITEM",
    location: params?.locationName || null,
    supplier: "TEST Supplier",
    quantity: 2,
    reorderLevel: 5,
    targetLevel: 12,
    unitCost: 1.25,
    salePrice: null,
    isActive: true,
  };
}

export function lowStockTestSuccessMessage(
  name: string,
  locationName?: string | null,
) {
  return `${name} was created with 2 units, a reorder level of 5 and a target level of 12${
    locationName ? ` in ${locationName}` : ""
  }. It should now appear on the Low Stock page as a high-priority test item.`;
}
