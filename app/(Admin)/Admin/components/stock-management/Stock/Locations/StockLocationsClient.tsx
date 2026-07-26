"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MoveStockModal, {
  EMPTY_MOVE_STOCK_FORM,
  type MoveStockFormState,
  type StockItemForMove,
} from "../AddStock/MoveStockModal";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Boxes,
  Building2,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Package,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";

type StockLocation = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isActive: boolean;
  itemCount: number;
  totalUnits: number;
  totalValue: number;
  updatedAt?: string | null;
  updatedByName?: string | null;
};

type MoveableStockItem = {
  id: string;
  name: string;
  sku?: string | null;
  quantity: number;
  locationId?: string | null;
  locationName?: string | null;
  unitValue?: number | null;
};

type LocationsResponse = {
  ok?: boolean;
  locations?: StockLocation[];
  location?: StockLocation;
  items?: MoveableStockItem[];
  message?: string;
  error?: string;
  reason?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
  field?: string | null;
  status?: number;
};

type MoveStockResponse = {
  ok?: boolean;
  items?: MoveableStockItem[];
  message?: string;
  error?: string;
  reason?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
  field?: string | null;
  status?: number;
};

type InventoryStockItem = {
  id: string;
  name: string;
  sku?: string | null;
  quantity?: number | string | null;
  location?: string | null;
  isActive?: boolean;
  unitCost?: number | string | null;
  stockValue?: number | string | null;
};

type InventoryResponse = {
  ok?: boolean;
  items?: InventoryStockItem[];
  error?: string;
  message?: string;
  reason?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
  field?: string | null;
};

type LocationForm = {
  id?: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
};

type Notice = {
  tone: "success" | "error" | "warning";
  title: string;
  message: string;
  technicalDetails?: string[];
};

const ENDPOINT = "/api/admin/stockmanagement/locations";
const INVENTORY_ENDPOINT =
  "/api/admin/stockmanagement/inventory";
const MOVE_STOCK_ENDPOINT =
  "/api/admin/stockmanagement/locations/movestock";
const AUDIT_ENDPOINT =
  "/api/admin/stockmanagement/audit-logs";

const EMPTY_FORM: LocationForm = {
  name: "",
  code: "",
  description: "",
  isActive: true,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

type DetailedApiError = Error & {
  title?: string;
  status?: number;
  statusText?: string;
  endpoint?: string;
  method?: string;
  code?: string;
  reason?: string;
  details?: string | null;
  hint?: string | null;
  field?: string | null;
  responseBody?: string | null;
};

async function readApiResponse(
  response: Response,
): Promise<{
  json: LocationsResponse | null;
  rawText: string;
}> {
  const rawText = await response.text();

  if (!rawText) {
    return {
      json: null,
      rawText: "",
    };
  }

  try {
    return {
      json: JSON.parse(rawText) as LocationsResponse,
      rawText,
    };
  } catch {
    return {
      json: null,
      rawText,
    };
  }
}

function createDetailedApiError(params: {
  response?: Response;
  json?: LocationsResponse | null;
  rawText?: string;
  endpoint: string;
  method: string;
  fallbackTitle: string;
  fallbackMessage: string;
}): DetailedApiError {
  const status = params.response?.status;
  const statusText = params.response?.statusText || "";
  const serverMessage =
    params.json?.error ||
    params.json?.message ||
    params.json?.reason ||
    "";

  const message =
    serverMessage ||
    (status === 400
      ? "The request contains missing or invalid location details."
      : status === 401
        ? "Your admin session is missing or has expired. Sign in again and retry."
        : status === 403
          ? "Your administrator account does not have permission to manage stock locations."
          : status === 404
            ? `The API route was not found: ${params.endpoint}. Check the route folder and file name.`
            : status === 409
              ? "The request conflicts with an existing location or with stock currently assigned to it."
              : status === 422
                ? "The server could not accept one or more submitted values."
                : status === 429
                  ? "Too many requests were made. Wait a moment and try again."
                  : status && status >= 500
                    ? "The server failed while processing the stock-location request. Check the terminal and Supabase logs."
                    : params.fallbackMessage);

  const error = new Error(message) as DetailedApiError;

  error.title = params.fallbackTitle;
  error.status = status;
  error.statusText = statusText;
  error.endpoint = params.endpoint;
  error.method = params.method;
  error.code = params.json?.code;
  error.reason = params.json?.reason;
  error.details = params.json?.details;
  error.hint = params.json?.hint;
  error.field = params.json?.field;
  error.responseBody =
    !params.json && params.rawText
      ? params.rawText.slice(0, 700)
      : null;

  return error;
}

function noticeFromError(
  caught: unknown,
  fallbackTitle: string,
  fallbackMessage: string,
): Notice {
  if (!(caught instanceof Error)) {
    return {
      tone: "error",
      title: fallbackTitle,
      message: fallbackMessage,
    };
  }

  const error = caught as DetailedApiError;
  const technicalDetails: string[] = [];

  if (typeof error.status === "number") {
    technicalDetails.push(
      `HTTP status: ${error.status}${
        error.statusText ? ` ${error.statusText}` : ""
      }`,
    );
  }

  if (error.method && error.endpoint) {
    technicalDetails.push(
      `Request: ${error.method} ${error.endpoint}`,
    );
  }

  if (error.code) {
    technicalDetails.push(`Error code: ${error.code}`);
  }

  if (error.reason && error.reason !== error.message) {
    technicalDetails.push(`Reason: ${error.reason}`);
  }

  if (error.field) {
    technicalDetails.push(`Field: ${error.field}`);
  }

  if (error.details) {
    technicalDetails.push(`Server details: ${error.details}`);
  }

  if (error.hint) {
    technicalDetails.push(`Server hint: ${error.hint}`);
  }

  if (error.responseBody) {
    technicalDetails.push(
      `Non-JSON response: ${error.responseBody}`,
    );
  }

  return {
    tone: "error",
    title: error.title || fallbackTitle,
    message: error.message || fallbackMessage,
    technicalDetails:
      technicalDetails.length > 0 ? technicalDetails : undefined,
  };
}


type StockAuditResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  auditId?: string | null;
  requestId?: string | null;
  message?: string;
};

type StockAuditPayload = {
  actionKey: string;
  actionLabel: string;
  actionCategory: "create" | "update" | "delete" | "move";
  module: "locations";
  status: "success";
  riskLevel: "low" | "medium" | "high";
  description: string;
  reason?: string | null;
  notes?: string | null;
  recordType: "stock_location" | "stock_movement";
  recordId?: string | null;
  recordName?: string | null;
  recordReference?: string | null;
  stockItemId?: string | null;
  stockItemName?: string | null;
  stockItemSku?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  fromLocationId?: string | null;
  fromLocationName?: string | null;
  toLocationId?: string | null;
  toLocationName?: string | null;
  quantityBefore?: number | null;
  quantityAfter?: number | null;
  quantityChanged?: number | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  changedFields?: string[];
  responseStatus?: number;
  apiEndpoint?: string;
  metadata?: Record<string, unknown>;
};

async function reportStockAudit(payload: StockAuditPayload) {
  const response = await fetch(AUDIT_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();

  let json: StockAuditResponse | null = null;

  if (rawText) {
    try {
      const parsed: unknown = JSON.parse(rawText);

      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        json = parsed as StockAuditResponse;
      }
    } catch {
      json = null;
    }
  }

  if (!response.ok || !json?.ok) {
    const message =
      json?.error ||
      `Audit reporting failed with HTTP ${response.status}.`;

    const error = new Error(message) as DetailedApiError;
    error.title = "The change succeeded but audit reporting failed";
    error.status = response.status;
    error.statusText = response.statusText;
    error.endpoint = AUDIT_ENDPOINT;
    error.method = "POST";
    error.code = json?.code;
    error.details = json?.details;
    error.hint = json?.hint;
    error.responseBody = !json && rawText ? rawText.slice(0, 700) : null;

    throw error;
  }

  return json;
}

function locationSnapshot(location: {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  isActive?: boolean | null;
}) {
  return {
    id: location.id || null,
    name: location.name || null,
    code: location.code || null,
    description: location.description || null,
    isActive: location.isActive !== false,
  };
}

function changedLocationFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)]),
  ).filter(
    (key) =>
      JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

export default function StockLocationsClient() {
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StockLocation | null>(null);
  const [moveFormOpen, setMoveFormOpen] = useState(false);
  const [moveForm, setMoveForm] =
    useState<MoveStockFormState>(EMPTY_MOVE_STOCK_FORM);
  const [moveableItems, setMoveableItems] = useState<MoveableStockItem[]>([]);
  const [loadingMoveItems, setLoadingMoveItems] = useState(false);
  const [movingStock, setMovingStock] = useState(false);

  const loadLocations = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(`${ENDPOINT}?includeArchived=true`, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const { json, rawText } = await readApiResponse(response);

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json,
          rawText,
          endpoint: `${ENDPOINT}?includeArchived=true`,
          method: "GET",
          fallbackTitle: "Stock locations could not be loaded",
          fallbackMessage:
            "The locations API did not return a successful response.",
        });
      }

      setLocations(Array.isArray(json.locations) ? json.locations : []);
    } catch (caught) {
      setLocations([]);
      setNotice(
        noticeFromError(
          caught,
          "Stock locations could not be loaded",
          "Refresh the page and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const filteredLocations = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return locations.filter((location) =>
      !cleanQuery
        ? true
        : [location.name, location.code, location.description]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(cleanQuery),
            ),
    );
  }, [locations, query]);

  const totals = useMemo(
    () => ({
      locations: locations.filter((location) => location.isActive).length,
      itemCount: locations.reduce(
        (total, location) => total + location.itemCount,
        0,
      ),
      units: locations.reduce(
        (total, location) => total + location.totalUnits,
        0,
      ),
    }),
    [locations],
  );

  function openCreate() {
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(location: StockLocation) {
    setForm({
      id: location.id,
      name: location.name,
      code: location.code || "",
      description: location.description || "",
      isActive: location.isActive,
    });
    setShowForm(true);
  }

  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    if (!form.name.trim()) {
      setNotice({
        tone: "warning",
        title: "Location name is required",
        message: "Enter a clear location name before saving.",
      });
      return;
    }

    const existingLocation = form.id
      ? locations.find((location) => location.id === form.id) || null
      : null;

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(ENDPOINT, {
        method: form.id ? "PATCH" : "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          name: form.name.trim(),
          code: form.code.trim() || null,
          description: form.description.trim() || null,
          isActive: form.isActive,
        }),
      });

      const { json, rawText } = await readApiResponse(response);

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json,
          rawText,
          endpoint: ENDPOINT,
          method: form.id ? "PATCH" : "POST",
          fallbackTitle: "Location could not be saved",
          fallbackMessage:
            "The stock-locations API rejected the submitted location.",
        });
      }

      const savedLocation =
        json.location ||
        ({
          id: form.id || null,
          name: form.name.trim(),
          code: form.code.trim() || null,
          description: form.description.trim() || null,
          isActive: form.isActive,
        } as unknown as StockLocation);

      const beforeData = existingLocation
        ? locationSnapshot(existingLocation)
        : null;
      const afterData = locationSnapshot(savedLocation);

      await reportStockAudit({
        actionKey: form.id
          ? "stock_location_updated"
          : "stock_location_created",
        actionLabel: form.id
          ? "Stock location updated"
          : "Stock location created",
        actionCategory: form.id ? "update" : "create",
        module: "locations",
        status: "success",
        riskLevel: "low",
        description: form.id
          ? `${form.name.trim()} was updated in Stock Management.`
          : `${form.name.trim()} was added as a Stock Management location.`,
        reason: form.id
          ? "Location details were changed using the Edit stock location form."
          : "Location was created using the Add stock location form.",
        recordType: "stock_location",
        recordId: savedLocation.id || form.id || null,
        recordName: form.name.trim(),
        recordReference: form.code.trim() || null,
        locationId: savedLocation.id || form.id || null,
        locationName: form.name.trim(),
        beforeData,
        afterData,
        changedFields: beforeData
          ? changedLocationFields(beforeData, afterData)
          : Object.keys(afterData),
        responseStatus: form.id ? 200 : 201,
        apiEndpoint: ENDPOINT,
        metadata: {
          source: "stock_locations_client",
          operation: form.id ? "update" : "create",
        },
      });

      setShowForm(false);
      setForm(EMPTY_FORM);
      setNotice({
        tone: "success",
        title: form.id ? "Location updated" : "Location created",
        message: `${form.name.trim()} has been saved and reported to the audit logs.`,
      });
      await loadLocations();
    } catch (caught) {
      setNotice(
        noticeFromError(
          caught,
          "Location could not be saved",
          "Check the details and try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function permanentlyDeleteLocation(
    mainAdminPassword: string,
  ) {
    if (!deleteTarget || saving) return;

    if (!mainAdminPassword.trim()) {
      setNotice({
        tone: "warning",
        title: "Main admin password is required",
        message:
          "Enter the main administrator password before permanently deleting this location.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(ENDPOINT, {
        method: "DELETE",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: deleteTarget.id,
          mainAdminPassword,
          permanentDelete: true,
        }),
      });

      const { json, rawText } = await readApiResponse(response);

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json,
          rawText,
          endpoint: ENDPOINT,
          method: "DELETE",
          fallbackTitle: "Location could not be deleted",
          fallbackMessage:
            "The stock-locations API rejected the permanent delete request.",
        });
      }

      const deletedLocation = locationSnapshot(deleteTarget);

      await reportStockAudit({
        actionKey: "stock_location_deleted",
        actionLabel: "Stock location permanently deleted",
        actionCategory: "delete",
        module: "locations",
        status: "success",
        riskLevel: "high",
        description: `${deleteTarget.name} was permanently deleted from Stock Management.`,
        reason: "Permanent deletion was confirmed with the main administrator password.",
        recordType: "stock_location",
        recordId: deleteTarget.id,
        recordName: deleteTarget.name,
        recordReference: deleteTarget.code || null,
        locationId: deleteTarget.id,
        locationName: deleteTarget.name,
        beforeData: deletedLocation,
        afterData: null,
        changedFields: Object.keys(deletedLocation),
        responseStatus: 200,
        apiEndpoint: ENDPOINT,
        metadata: {
          source: "stock_locations_client",
          permanentDelete: true,
          linkedItemCountBeforeDelete: deleteTarget.itemCount,
          totalUnitsBeforeDelete: deleteTarget.totalUnits,
        },
      });

      setNotice({
        tone: "success",
        title: "Location permanently deleted",
        message: `${deleteTarget.name} has been permanently removed and reported to the audit logs.`,
      });
      setDeleteTarget(null);
      await loadLocations();
    } catch (caught) {
      setNotice(
        noticeFromError(
          caught,
          "Location could not be deleted",
          "Check the password and make sure no inventory items are linked to this location.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function loadMoveableItems(locationId?: string) {
    setLoadingMoveItems(true);

    try {
      /*
       * Stock items are owned by the Inventory API.
       * The move-stock endpoint is only used when the move is submitted.
       */
      const response = await fetch(INVENTORY_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const rawText = await response.text();

      let inventoryJson: InventoryResponse | null = null;

      if (rawText) {
        try {
          inventoryJson = JSON.parse(rawText) as InventoryResponse;
        } catch {
          inventoryJson = null;
        }
      }

      if (!response.ok || !inventoryJson?.ok) {
        throw createDetailedApiError({
          response,
          json: inventoryJson as LocationsResponse | null,
          rawText,
          endpoint: INVENTORY_ENDPOINT,
          method: "GET",
          fallbackTitle: "Stock items could not be loaded",
          fallbackMessage:
            "The Inventory API did not return the available stock items.",
        });
      }

      const activeLocationsById = new Map(
        locations
          .filter((location) => location.isActive)
          .map((location) => [location.id, location]),
      );

      const nextItems = (Array.isArray(inventoryJson.items)
        ? inventoryJson.items
        : []
      )
        .map((item): MoveableStockItem | null => {
          const quantity = Math.max(
            0,
            Math.floor(Number(item.quantity || 0)),
          );
          const itemLocationId = String(item.location || "").trim();
          const itemLocation =
            activeLocationsById.get(itemLocationId) || null;

          if (
            item.isActive === false ||
            quantity < 1 ||
            !itemLocation
          ) {
            return null;
          }

          return {
            id: item.id,
            name: item.name,
            sku: item.sku || null,
            quantity,
            locationId: itemLocation.id,
            locationName: itemLocation.name,
            unitValue:
              item.unitCost === null || item.unitCost === undefined
                ? null
                : Number(item.unitCost),
          };
        })
        .filter(
          (item): item is MoveableStockItem => item !== null,
        )
        .filter(
          (item) =>
            !locationId || item.locationId === locationId,
        )
        .sort((left, right) =>
          left.name.localeCompare(right.name),
        );

      setMoveableItems(nextItems);
    } catch (caught) {
      setMoveableItems([]);
      setNotice(
        noticeFromError(
          caught,
          "Stock items could not be loaded",
          "The live inventory could not be loaded. Refresh the page and try opening the move-stock form again.",
        ),
      );
    } finally {
      setLoadingMoveItems(false);
    }
  }

  function openMoveStock(fromLocation?: StockLocation) {
    setMoveForm(EMPTY_MOVE_STOCK_FORM);
    setMoveFormOpen(true);
    setNotice(null);
    void loadMoveableItems(fromLocation?.id);
  }

  function closeMoveStock() {
    if (movingStock) return;

    setMoveFormOpen(false);
    setMoveForm(EMPTY_MOVE_STOCK_FORM);
    setMoveableItems([]);
  }

  async function moveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (movingStock) return;

    const selectedItem =
      moveableItems.find((item) => item.id === moveForm.stockItemId) || null;

    if (!selectedItem) {
      setNotice({
        tone: "warning",
        title: "Choose a stock item",
        message: "Select the item that you want to move.",
      });
      return;
    }

    const currentLocationValue = String(
      selectedItem.locationId || selectedItem.locationName || "",
    ).trim();

    const currentLocation = locations.find(
      (location) =>
        location.id === currentLocationValue ||
        location.name.toLowerCase() === currentLocationValue.toLowerCase(),
    );

    if (!currentLocation) {
      setNotice({
        tone: "warning",
        title: "Current location could not be found",
        message:
          "The selected stock item is not assigned to a valid active location.",
      });
      return;
    }

    const destination = locations.find(
      (location) => location.id === moveForm.destinationLocation,
    );

    if (!destination || destination.isActive === false) {
      setNotice({
        tone: "warning",
        title: "Choose the destination",
        message: "Select an active location where the stock should be moved.",
      });
      return;
    }

    if (currentLocation.id === destination.id) {
      setNotice({
        tone: "warning",
        title: "Choose a different destination",
        message:
          "The destination location must be different from the current location.",
      });
      return;
    }

    if (!moveForm.reason.trim()) {
      setNotice({
        tone: "warning",
        title: "A reason is required",
        message: "Explain why the stock is being moved.",
      });
      return;
    }

    const quantity = moveForm.moveAllStock
      ? selectedItem.quantity
      : Number(moveForm.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > selectedItem.quantity
    ) {
      setNotice({
        tone: "warning",
        title: "Enter a valid quantity",
        message: `Choose a whole number between 1 and ${selectedItem.quantity}.`,
      });
      return;
    }

    setMovingStock(true);
    setNotice(null);

    try {
      const combinedNotes = [
        moveForm.reason.trim(),
        moveForm.notes.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await fetch(MOVE_STOCK_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId: selectedItem.id,
          fromLocationId: currentLocation.id,
          toLocationId: destination.id,
          quantity,
          notes: combinedNotes || null,
        }),
      });

      const { json, rawText } = await readApiResponse(response);

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json,
          rawText,
          endpoint: MOVE_STOCK_ENDPOINT,
          method: "POST",
          fallbackTitle: "Stock could not be moved",
          fallbackMessage:
            "The move-stock API rejected the stock movement.",
        });
      }

      const quantityBefore = selectedItem.quantity;
      const quantityAfter = moveForm.moveAllStock
        ? 0
        : Math.max(0, selectedItem.quantity - quantity);

      await reportStockAudit({
        actionKey: "stock_location_moved",
        actionLabel: "Stock moved between locations",
        actionCategory: "move",
        module: "locations",
        status: "success",
        riskLevel: "medium",
        description: `${quantity} unit${
          quantity === 1 ? "" : "s"
        } of ${selectedItem.name} ${
          quantity === 1 ? "was" : "were"
        } moved from ${currentLocation.name} to ${destination.name}.`,
        reason: moveForm.reason.trim(),
        notes: moveForm.notes.trim() || null,
        recordType: "stock_movement",
        recordId: null,
        recordName: selectedItem.name,
        recordReference: selectedItem.sku || null,
        stockItemId: selectedItem.id,
        stockItemName: selectedItem.name,
        stockItemSku: selectedItem.sku || null,
        locationId: destination.id,
        locationName: destination.name,
        fromLocationId: currentLocation.id,
        fromLocationName: currentLocation.name,
        toLocationId: destination.id,
        toLocationName: destination.name,
        quantityBefore,
        quantityAfter,
        quantityChanged: -quantity,
        beforeData: {
          stockItemId: selectedItem.id,
          stockItemName: selectedItem.name,
          locationId: currentLocation.id,
          locationName: currentLocation.name,
          quantity: quantityBefore,
        },
        afterData: {
          stockItemId: selectedItem.id,
          stockItemName: selectedItem.name,
          locationId: destination.id,
          locationName: destination.name,
          quantityMoved: quantity,
          quantityRemainingAtSource: quantityAfter,
        },
        changedFields: [
          "locationId",
          "locationName",
          "quantity",
        ],
        responseStatus: 200,
        apiEndpoint: MOVE_STOCK_ENDPOINT,
        metadata: {
          source: "stock_locations_client",
          moveAllStock: moveForm.moveAllStock,
        },
      });

      setNotice({
        tone: "success",
        title: "Stock moved successfully",
        message:
          json.message ||
          `${quantity} unit${quantity === 1 ? "" : "s"} of ${
            selectedItem.name
          } ${quantity === 1 ? "has" : "have"} been moved to ${
            destination.name
          } and reported to the audit logs.`,
      });

      closeMoveStock();
      await loadLocations();
    } catch (caught) {
      setNotice(
        noticeFromError(
          caught,
          "Stock could not be moved",
          "Check the selected item, quantity and destination, then try again.",
        ),
      );
    } finally {
      setMovingStock(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-transparent px-3 py-5 text-white sm:px-5 sm:py-7 lg:px-7">
      <div className="w-full max-w-none">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/Admin/StockManagement/Inventory"
            className="inline-flex items-center gap-2 text-sm font-bold text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>

          <button
            type="button"
            onClick={() => void loadLocations()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black transition hover:bg-white/[0.1]"
          >
            <RefreshCcw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <header className="relative overflow-hidden rounded-[2rem] border border-blue-300/15 bg-[#1d2d4d] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)] sm:p-8 lg:p-9">
          <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-blue-100">
                <MapPin className="h-4 w-4" />
                Burton Pride Stock Control
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Stock locations
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">
                Create storage areas such as cupboards, rooms, shelves and containers. See how many stock items and total units are kept in each location.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openMoveStock()}
                disabled={
                  locations.filter((location) => location.isActive).length < 2
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200/20 bg-white/10 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRightLeft className="h-5 w-5" />
                Move stock
              </button>

              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-blue-300"
              >
                <Plus className="h-5 w-5" />
                Add location
              </button>
            </div>
          </div>
        </header>

        {notice ? (
          <div className="mt-6">
            <NoticePanel notice={notice} onClose={() => setNotice(null)} />
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Active locations"
            value={totals.locations}
            icon={Warehouse}
          />
          <SummaryCard
            label="Stock items assigned"
            value={totals.itemCount}
            icon={Boxes}
          />
          <SummaryCard
            label="Total units stored"
            value={totals.units}
            icon={Package}
          />
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/14 bg-white/[0.045] p-4 shadow-xl backdrop-blur-md sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              name="stock-location-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search locations by name, code or description..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-12 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-blue-300/50"
            />

            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-blue-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Clear location search"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </section>

        <section className="mt-6">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04]">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-200" />
                <p className="mt-4 font-black">Loading stock locations...</p>
              </div>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
              <div className="max-w-md text-center">
                <MapPin className="mx-auto h-10 w-10 text-blue-200" />
                <h2 className="mt-4 text-xl font-black">
                  No stock locations found
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  Add the first storage location so inventory items can be
                  assigned to it.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredLocations.map((location) => (
                <LocationCard
                  key={location.id}
                  location={location}
                  onEdit={() => openEdit(location)}
                  onMove={() => openMoveStock(location)}
                  onDelete={() => setDeleteTarget(location)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {showForm ? (
        <LocationFormModal
          form={form}
          saving={saving}
          onChange={setForm}
          onClose={() => setShowForm(false)}
          onSubmit={saveLocation}
        />
      ) : null}

      {moveFormOpen ? (
        <MoveStockModal
          form={moveForm}
          items={moveableItems.map(
            (item): StockItemForMove => ({
              id: item.id,
              name: item.name,
              sku: item.sku || "",
              location: item.locationName || item.locationId || null,
              quantity: item.quantity,
              isActive: true,
            }),
          )}
          locations={locations.map((location) => ({
            id: location.id,
            name: location.name,
            code: location.code,
            isActive: location.isActive,
          }))}
          saving={movingStock}
          loadingItems={loadingMoveItems}
          onChange={setMoveForm}
          onClose={closeMoveStock}
          onSubmit={moveStock}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteLocationModal
          location={deleteTarget}
          saving={saving}
          onClose={() => setDeleteTarget(null)}
          onConfirm={(password) =>
            void permanentlyDeleteLocation(password)
          }
        />
      ) : null}
    </main>
  );
}

function LocationCard({
  location,
  onEdit,
  onMove,
  onDelete,
}: {
  location: StockLocation;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-300/15 bg-blue-500/10 text-blue-100">
            <Building2 className="h-6 w-6" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-lg font-black">{location.name}</h2>
            <p className="mt-1 text-xs text-white/40">
              {location.code || "No location code"}
            </p>
          </div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-black ${
            location.isActive
              ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
              : "border-white/10 bg-white/[0.05] text-white/45"
          }`}
        >
          {location.isActive ? "Active" : "Archived"}
        </span>
      </div>

      {location.description ? (
        <p className="mt-4 text-sm leading-6 text-white/55">
          {location.description}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label="Items" value={location.itemCount} />
        <Metric label="Units" value={location.totalUnits} />
        <Metric label="Value" value={formatCurrency(location.totalValue)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
        <Link
          href={`/Admin/StockManagement/Inventory?location=${encodeURIComponent(
            location.name,
          )}`}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-black transition hover:bg-white/[0.1]"
        >
          <Eye className="h-4 w-4" />
          View items
        </Link>

        <button
          type="button"
          onClick={onMove}
          disabled={location.totalUnits < 1}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/15 bg-blue-500/10 px-3 py-2.5 text-xs font-black text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowRightLeft className="h-4 w-4" />
          Move stock
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-xs font-black transition hover:bg-white/[0.1]"
        >
          <Edit3 className="h-4 w-4" />
          Edit
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center justify-center rounded-xl border border-red-300/15 bg-red-500/10 px-3 py-2.5 text-red-100 transition hover:bg-red-500/20"
          aria-label={`Permanently delete ${location.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Warehouse;
}) {
  return (
    <article className="rounded-[1.75rem] border border-blue-300/15 bg-blue-500/10 p-5 text-blue-50 shadow-lg">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.13em] text-blue-100/65">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/15">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function LocationFormModal({
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: LocationForm;
  saving: boolean;
  onChange: (form: LocationForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title={form.id ? "Edit stock location" : "Add stock location"}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5 p-6">
        <Field
          label="Location name"
          help="Use a clear name people will recognise."
          value={form.name}
          onChange={(value) => onChange({ ...form, name: value })}
          placeholder="Example: Main warehouse"
          required
        />

        <Field
          label="Location code"
          help="Optional short reference used on labels or reports."
          value={form.code}
          onChange={(value) => onChange({ ...form, code: value })}
          placeholder="Example: WH-01"
        />

        <label className="block">
          <span className="block text-sm font-black">Description</span>
          <span className="mt-1 block text-xs leading-5 text-white/40">
            Explain where this location is or what is stored there.
          </span>
          <textarea
            value={form.description}
            onChange={(event) =>
              onChange({ ...form, description: event.target.value })
            }
            rows={4}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm outline-none focus:border-blue-300/50"
            placeholder="Example: Ground-floor warehouse beside the loading door."
          />
        </label>

        <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              onChange({ ...form, isActive: event.target.checked })
            }
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-sm font-black">Active location</span>
            <span className="mt-1 block text-xs leading-5 text-white/40">
              Active locations can be selected when adding or editing stock.
            </span>
          </span>
        </label>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            Save location
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteLocationModal({
  location,
  saving,
  onClose,
  onConfirm,
}: {
  location: StockLocation;
  saving: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const hasLinkedItems = location.itemCount > 0;

  return (
    <Modal title="Permanently delete this stock location?" onClose={onClose}>
      <div
        className="space-y-5 p-6"
        data-lpignore="true"
        data-1p-ignore="true"
        data-bwignore="true"
      >
        <div
          className={`rounded-2xl border p-4 ${
            hasLinkedItems
              ? "border-red-300/20 bg-red-500/10"
              : "border-amber-300/20 bg-amber-500/10"
          }`}
        >
          <div className="flex gap-3">
            <AlertTriangle
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                hasLinkedItems ? "text-red-100" : "text-amber-100"
              }`}
            />
            <div>
              <p
                className={`font-black ${
                  hasLinkedItems ? "text-red-50" : "text-amber-50"
                }`}
              >
                {location.name}
              </p>
              <p
                className={`mt-1 text-sm leading-6 ${
                  hasLinkedItems ? "text-red-50/75" : "text-amber-50/70"
                }`}
              >
                This location currently contains {location.itemCount} stock
                item{location.itemCount === 1 ? "" : "s"} and{" "}
                {location.totalUnits} units.
              </p>
            </div>
          </div>
        </div>

        {hasLinkedItems ? (
          <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
            <p className="font-black text-red-50">
              This location cannot be deleted yet
            </p>
            <p className="mt-2 text-sm leading-6 text-red-50/75">
              Move every active inventory item to another stock location first.
              The delete button will remain disabled while items are linked to
              this location.
            </p>

            <Link
              href={`/Admin/StockManagement/Inventory?location=${encodeURIComponent(
                location.name,
              )}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-red-700"
            >
              <Eye className="h-4 w-4" />
              View linked inventory items
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
              <p className="font-black text-red-50">
                This action cannot be undone
              </p>
              <p className="mt-2 text-sm leading-6 text-red-50/75">
                The location record will be fully removed from the database.
                It will not be archived and cannot be restored later.
              </p>
            </div>

            <label className="block">
              <span className="block text-sm font-black text-white">
                Main administrator password
              </span>
              <span className="mt-1 block text-xs leading-5 text-white/45">
                Enter the main admin password to confirm this permanent delete.
              </span>
              <div className="relative mt-3">
                <input
                  type={showPassword ? "text" : "password"}
                  name="stock-location-delete-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  placeholder="Enter main admin password"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 pr-14 text-sm text-white outline-none placeholder:text-white/25 focus:border-red-300/50"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/55 transition hover:bg-white/[0.1] hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>
          </>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black disabled:opacity-50"
          >
            Keep location
          </button>

          <button
            type="button"
            onClick={() => onConfirm(password)}
            disabled={
              saving ||
              hasLinkedItems ||
              password.trim().length === 0
            }
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Permanently delete location
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/15 bg-[#111827] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <h2 className="text-2xl font-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  help,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-black">
        {label}
        {required ? <span className="ml-1 text-blue-200">*</span> : null}
      </span>
      <span className="mt-1 block text-xs leading-5 text-white/40">
        {help}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm outline-none focus:border-blue-300/50"
      />
    </label>
  );
}

function NoticePanel({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const success = notice.tone === "success";
  const warning = notice.tone === "warning";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        success
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-50"
          : warning
            ? "border-amber-300/20 bg-amber-500/10 text-amber-50"
            : "border-red-300/20 bg-red-500/10 text-red-50"
      }`}
    >
      <div className="flex gap-3">
        {success ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5" />
        )}
        <div className="flex-1">
          <p className="font-black">{notice.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-80">
            {notice.message}
          </p>

          {notice.technicalDetails?.length ? (
            <details className="mt-3 rounded-xl border border-current/15 bg-black/15 p-3">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em]">
                Show technical details
              </summary>

              <div className="mt-3 space-y-2 text-xs leading-5 opacity-80">
                {notice.technicalDetails.map((detail) => (
                  <p key={detail} className="break-words font-mono">
                    {detail}
                  </p>
                ))}
              </div>
            </details>
          ) : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Close message">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
