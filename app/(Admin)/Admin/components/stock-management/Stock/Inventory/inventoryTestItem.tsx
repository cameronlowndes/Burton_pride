export type TestInventoryPayload = {
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
  salePrice: number;
  isActive: boolean;
};

function createUniqueTestReference() {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();

  return {
    sku: `TEST-${timestamp}-${randomPart}`,
  };
}

export function createTestInventoryPayload({
  locationId,
}: {
  locationId?: string | null;
}): TestInventoryPayload {
  const reference = createUniqueTestReference();

  return {
    name: "TEST ITEM – Delete After Testing",
    sku: reference.sku,
    barcode: null,
    description:
      "Automatically created test record. Use this item to test stock adjustments, searching, filtering, locations and archiving. Delete or archive it when testing is complete.",
    category: "System Test",
    location: locationId || null,
    supplier: "Burton Pride Test Data",
    quantity: 10,
    reorderLevel: 2,
    targetLevel: 20,
    unitCost: 0.5,
    salePrice: 1,
    isActive: true,
  };
}

export function getTestItemSuccessMessage(
  name: string,
  sku: string,
  locationName?: string | null,
) {
  const locationText = locationName
    ? ` It was assigned to ${locationName}.`
    : " No active location was available, so its location was left empty.";

  return `${name} was created with SKU ${sku}.${locationText} Archive or delete it after testing.`;
}