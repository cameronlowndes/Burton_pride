import type { RepeatFrequency, Transaction } from "./types";

export function money(amountPence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((amountPence || 0) / 100);
}

export function pounds(amountPence: number | null | undefined) {
  return (amountPence || 0) / 100;
}

export function none(value: string | null | undefined) {
  if (!value || !String(value).trim()) return "None";
  return value;
}

export function sourceLabel(source: string | null) {
  if (source === "website_donation") return "Website Donation";
  if (source === "website_monthly_donation") return "Monthly Donation";
  if (source === "sponsorship") return "Sponsorship";
  if (source === "manual") return "Manual";
  if (!source) return "Manual";

  return source
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "None";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getTransactionYear(value: string | null | undefined) {
  if (!value) return new Date().getFullYear().toString();

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().getFullYear().toString();
  }

  return date.getFullYear().toString();
}

export function getTransactionMonthKey(value: string | null | undefined) {
  const fallback = new Date();

  if (!value) {
    return `${fallback.getFullYear()}-${String(
      fallback.getMonth() + 1
    ).padStart(2, "0")}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return `${fallback.getFullYear()}-${String(
      fallback.getMonth() + 1
    ).padStart(2, "0")}`;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

export function monthNameFromKey(monthKey: string) {
  if (monthKey === "all") return "Full Year";

  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function addRepeatingDate(
  startDate: string,
  index: number,
  frequency: RepeatFrequency
) {
  const date = new Date(`${startDate}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return startDate;
  }

  if (frequency === "weekly") {
    date.setDate(date.getDate() + index * 7);
  }

  if (frequency === "monthly") {
    date.setMonth(date.getMonth() + index);
  }

  if (frequency === "yearly") {
    date.setFullYear(date.getFullYear() + index);
  }

  return date.toISOString().slice(0, 10);
}

export function repeatFrequencyLabel(frequency: RepeatFrequency) {
  if (frequency === "weekly") return "weekly";
  if (frequency === "monthly") return "monthly";
  return "yearly";
}

export function isPersonalFundsTransaction(item: Transaction) {
  return (
    item.type === "expense" &&
    (item.is_personal_funds === true ||
      item.payment_method?.toLowerCase() === "personal funds")
  );
}

export function isSponsorshipTransaction(item: Transaction) {
  return (
    Boolean(item.sponsor_id || item.sponsor_name) ||
    item.source === "sponsorship" ||
    item.category?.toLowerCase() === "sponsorship"
  );
}

export function sponsorNameMatches(
  a: string | null | undefined,
  b: string | null | undefined
) {
  return Boolean(a && b && a.toLowerCase().trim() === b.toLowerCase().trim());
}