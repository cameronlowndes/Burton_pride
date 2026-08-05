import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable();

export const vendorApplicationSchema = z
  .object({
    eventId: z.string().uuid(),

    applicationType: z.enum([
      "stallholder",
      "food_vendor",
      "charity",
      "cic",
    ]),

    pitchType: z
      .enum(["standard", "double"])
      .optional()
      .nullable(),

    organisationName: z.string().trim().min(2).max(200),
    tradingName: z.string().trim().max(200).optional().nullable(),

    contactName: z.string().trim().min(2).max(150),
    contactEmail: z.string().trim().email().max(250),
    contactPhone: z.string().trim().min(7).max(40),

    addressLine1: z.string().trim().min(2).max(250),
    addressLine2: z.string().trim().max(250).optional().nullable(),
    townCity: z.string().trim().min(2).max(150),
    county: z.string().trim().max(150).optional().nullable(),
    postcode: z.string().trim().min(3).max(20),

    website: z.string().trim().max(300).optional().nullable(),
    socialMedia: z.string().trim().max(500).optional().nullable(),

    description: z.string().trim().min(20).max(4000),
    productsServices: z.string().trim().min(10).max(4000),

    electricityRequired: z.boolean(),
    electricityDetails: optionalText,

    gazeboWidthMetres: z.number().min(0).max(30).optional().nullable(),
    gazeboDepthMetres: z.number().min(0).max(30).optional().nullable(),

    publicLiabilityInsurance: z.boolean(),
    publicLiabilityExpiryDate: z
      .string()
      .trim()
      .optional()
      .nullable(),

    foodHygieneRating: z.string().trim().max(20).optional().nullable(),
    foodRegistrationAuthority: optionalText,

    usesGas: z.boolean(),
    usesGenerator: z.boolean(),
    generatorDetails: optionalText,

    charityNumber: z.string().trim().max(100).optional().nullable(),
    companyNumber: z.string().trim().max(100).optional().nullable(),

    accessibilityRequirements: optionalText,
    additionalInformation: optionalText,

    termsAccepted: z.literal(true),
    dataProcessingAccepted: z.literal(true),
  })
  .superRefine((data, context) => {
    if (
      data.applicationType === "stallholder" &&
      !data.pitchType
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pitchType"],
        message: "Please select a standard or double pitch.",
      });
    }

    if (
      data.electricityRequired &&
      !data.electricityDetails
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["electricityDetails"],
        message: "Please explain your electricity requirements.",
      });
    }

    if (
      data.usesGenerator &&
      !data.generatorDetails
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["generatorDetails"],
        message: "Please provide details about the generator.",
      });
    }

    if (
      data.applicationType === "charity" &&
      !data.charityNumber
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["charityNumber"],
        message: "Please provide the registered charity number.",
      });
    }

    if (
      data.applicationType === "cic" &&
      !data.companyNumber
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companyNumber"],
        message: "Please provide the C.I.C. company number.",
      });
    }
  });