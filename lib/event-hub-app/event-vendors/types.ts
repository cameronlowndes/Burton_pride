export type VendorApplicationType =
  | "stallholder"
  | "food_vendor"
  | "charity"
  | "cic";

export type VendorPitchType =
  | "standard"
  | "double";

export type VendorApplicationStatus =
  | "pending"
  | "under_review"
  | "needs_information"
  | "approved"
  | "rejected"
  | "withdrawn";

export type VendorPaymentStatus =
  | "not_required"
  | "awaiting_payment"
  | "paid"
  | "refunded"
  | "waived";

export type EventVendorApplication = {
  id: string;
  event_id: string;

  application_reference: string;

  application_type: VendorApplicationType;
  pitch_type: VendorPitchType | null;

  organisation_name: string;
  trading_name: string | null;

  contact_name: string;
  contact_email: string;
  contact_phone: string;

  address_line1: string;
  address_line2: string | null;
  town_city: string;
  county: string | null;
  postcode: string;

  website: string | null;
  social_media: string | null;

  description: string;
  products_services: string;

  electricity_required: boolean;
  electricity_details: string | null;

  gazebo_width_metres: number | null;
  gazebo_depth_metres: number | null;

  public_liability_insurance: boolean;
  public_liability_expiry_date: string | null;
  public_liability_document_url: string | null;

  food_hygiene_rating: string | null;
  food_hygiene_document_url: string | null;
  food_registration_authority: string | null;

  uses_gas: boolean;
  gas_safety_document_url: string | null;

  uses_generator: boolean;
  generator_details: string | null;

  charity_number: string | null;
  company_number: string | null;
  charity_or_cic_proof_url: string | null;

  accessibility_requirements: string | null;
  additional_information: string | null;

  terms_accepted: boolean;
  data_processing_accepted: boolean;

  fee_pence: number;
  payment_status: VendorPaymentStatus;
  application_status: VendorApplicationStatus;

  admin_notes: string | null;
  applicant_message: string | null;

  reviewed_by: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;

  submitted_ip: string | null;
  submitted_user_agent: string | null;

  created_at: string;
  updated_at: string;
};

export type VendorApplicationSummary = Pick<
  EventVendorApplication,
  | "id"
  | "event_id"
  | "application_reference"
  | "application_type"
  | "pitch_type"
  | "organisation_name"
  | "trading_name"
  | "contact_name"
  | "contact_email"
  | "contact_phone"
  | "fee_pence"
  | "payment_status"
  | "application_status"
  | "created_at"
  | "updated_at"
>;

export type CreateVendorApplicationInput = {
  eventId: string;

  applicationType: VendorApplicationType;
  pitchType?: VendorPitchType | null;

  organisationName: string;
  tradingName?: string | null;

  contactName: string;
  contactEmail: string;
  contactPhone: string;

  addressLine1: string;
  addressLine2?: string | null;
  townCity: string;
  county?: string | null;
  postcode: string;

  website?: string | null;
  socialMedia?: string | null;

  description: string;
  productsServices: string;

  electricityRequired: boolean;
  electricityDetails?: string | null;

  gazeboWidthMetres?: number | null;
  gazeboDepthMetres?: number | null;

  publicLiabilityInsurance: boolean;
  publicLiabilityExpiryDate?: string | null;
  publicLiabilityDocumentPath?: string | null;

  foodHygieneRating?: string | null;
  foodHygieneDocumentPath?: string | null;
  foodRegistrationAuthority?: string | null;

  usesGas: boolean;
  gasSafetyDocumentPath?: string | null;

  usesGenerator: boolean;
  generatorDetails?: string | null;

  charityNumber?: string | null;
  companyNumber?: string | null;
  charityOrCicProofPath?: string | null;

  accessibilityRequirements?: string | null;
  additionalInformation?: string | null;

  termsAccepted: boolean;
  dataProcessingAccepted: boolean;
};

export type UpdateVendorApplicationInput = {
  applicationStatus: VendorApplicationStatus;
  paymentStatus?: VendorPaymentStatus;

  applicantMessage?: string | null;
  adminNotes?: string | null;

  sendEmail?: boolean;
};

export function calculateVendorFee(
  applicationType: VendorApplicationType,
  pitchType?: VendorPitchType | null,
): number {
  if (
    applicationType === "charity" ||
    applicationType === "cic"
  ) {
    return 0;
  }

  if (applicationType === "food_vendor") {
    return 9500;
  }

  if (
    applicationType === "stallholder" &&
    pitchType === "double"
  ) {
    return 5500;
  }

  return 2500;
}

export function formatVendorFee(feePence: number): string {
  if (feePence === 0) {
    return "Free";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(feePence / 100);
}

export function formatVendorApplicationType(
  type: VendorApplicationType,
): string {
  switch (type) {
    case "food_vendor":
      return "Food vendor";

    case "charity":
      return "Registered charity";

    case "cic":
      return "Community Interest Company";

    case "stallholder":
    default:
      return "Stallholder";
  }
}

export function formatVendorPitchType(
  pitchType: VendorPitchType | null,
): string {
  switch (pitchType) {
    case "double":
      return "Double pitch";

    case "standard":
      return "Standard pitch";

    default:
      return "Not applicable";
  }
}

export function formatVendorApplicationStatus(
  status: VendorApplicationStatus,
): string {
  switch (status) {
    case "under_review":
      return "Under review";

    case "needs_information":
      return "Needs information";

    case "approved":
      return "Approved";

    case "rejected":
      return "Rejected";

    case "withdrawn":
      return "Withdrawn";

    case "pending":
    default:
      return "Pending";
  }
}

export function formatVendorPaymentStatus(
  status: VendorPaymentStatus,
): string {
  switch (status) {
    case "not_required":
      return "Not required";

    case "awaiting_payment":
      return "Awaiting payment";

    case "paid":
      return "Paid";

    case "refunded":
      return "Refunded";

    case "waived":
      return "Waived";

    default:
      return status;
  }
}