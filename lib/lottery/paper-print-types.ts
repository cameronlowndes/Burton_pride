export type PaperBatchSummary = {
  id: string; lottery_id: string; batch_reference: string; lottery_title: string;
  quantity: number; status: string; created_at: string;
  pdf_ready: boolean; pdf_sha256: string | null; pdf_page_count: number | null;
  pdf_bytes: number | null; pdf_generated_at: string | null;
  page_size: string; tickets_per_sheet: number; duplex_flip: string;
  code_format: string; printed_at: string | null;
};
export const PRINT_CHECK_LABELS = {
  preview_checked: "I checked the PDF preview and ticket details.",
  test_print_checked: "I printed and checked a physical test sheet.",
  alignment_checked: "The fronts and backs match and line up correctly.",
  barcode_scanned: "I scanned a printed code and checked the matching ticket.",
  full_batch_printed: "The full batch has now been printed successfully.",
} as const;
export type PrintChecks = Record<keyof typeof PRINT_CHECK_LABELS, boolean>;
export const EMPTY_PRINT_CHECKS: PrintChecks = {
  preview_checked: false, test_print_checked: false, alignment_checked: false,
  barcode_scanned: false, full_batch_printed: false,
};
