export type ApplicationType =
  | "all"
  | "stallholder"
  | "food_vendor"
  | "charity"
  | "cic";

export type VendorApplicationType =
  Exclude<ApplicationType, "all">;

export type ApplicationTermsStatus =
  | "draft"
  | "published"
  | "archived";

export type EventApplicationTerms = {
  id: string;
  event_id: string;
  application_type: ApplicationType;
  title: string;
  introduction: string | null;
  content_html: string;
  content_text: string | null;
  version: number;
  status: ApplicationTermsStatus;
  is_current: boolean;
  effective_from: string | null;
  published_at: string | null;
  created_by: string | null;
  created_by_email: string | null;
  updated_by: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type EventApplicationTermsAcceptance = {
  id: string;
  event_id: string;
  application_id: string | null;
  application_reference: string | null;
  organisation_name: string;
  contact_name: string | null;
  contact_email: string;
  application_type: VendorApplicationType;
  terms_id: string;
  terms_version: number;
  terms_title: string;
  accepted: boolean;
  accepted_at: string;
  acceptance_statement: string;
};

export const APPLICATION_TYPE_OPTIONS: Array<{
  value: ApplicationType;
  label: string;
}> = [
  { value: "all", label: "All applications" },
  { value: "stallholder", label: "Stallholders" },
  { value: "food_vendor", label: "Food vendors" },
  { value: "charity", label: "Charities" },
  { value: "cic", label: "Community Interest Companies" },
];
