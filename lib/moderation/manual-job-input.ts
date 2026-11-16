import { z } from "zod";
export const JOBS_PAGE = "/Admin/SocialMediaModeration/JobsID";
export const MANUAL_PAGE = JOBS_PAGE + "/Manual";
export const MANUAL_API = "/api/admin/social-media-moderation/manual-jobs";
const text = (max: number) =>
  z
    .string()
    .max(max)
    .regex(/^[^\u0000]*$/, "Remove the unsupported null character.");
export function cleanSourceUrl(
  value: string,
  platform: "facebook" | "instagram",
) {
  if (!value.trim()) return "";
  const url = new URL(value.trim());
  const hosts =
    platform === "facebook"
      ? [
          "facebook.com",
          "www.facebook.com",
          "m.facebook.com",
          "web.facebook.com",
        ]
      : ["instagram.com", "www.instagram.com"];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !hosts.includes(url.hostname)
  )
    throw new Error(
      "Use an https link on the selected Facebook or Instagram platform.",
    );
  const keep =
    platform === "facebook"
      ? ["comment_id", "reply_comment_id", "story_fbid", "fbid", "id"]
      : ["comment_id"];
  for (const key of [...url.searchParams.keys()])
    if (!keep.includes(key)) url.searchParams.delete(key);
  url.hash = "";
  if (url.href.length > 1000) throw new Error("The source link is too long.");
  return url.href;
}
export const manualFields = z
  .object({
    platform: z.enum(["facebook", "instagram"]),
    content: text(10000).refine(
      (v) => v.trim().length > 0,
      "Paste the comment text.",
    ),
    reason: text(2000)
      .trim()
      .min(5, "Explain why this needs review in at least five characters."),
    context: text(200).trim(),
    url: text(2000).trim(),
    commentId: text(100)
      .trim()
      .refine(
        (v) => !v || /^\d+(?:_\d+)?$/.test(v),
        "Use a numeric comment ID, or leave this field blank.",
      ),
  })
  .strict()
  .superRefine((v, ctx) => {
    try {
      cleanSourceUrl(v.url, v.platform);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: e instanceof Error ? e.message : "Check the source link.",
      });
    }
  })
  .transform((v) => ({ ...v, url: cleanSourceUrl(v.url, v.platform) }));
export type ManualFields = z.input<typeof manualFields>;
export type ManualSummary = {
  jobId: string;
  createdBy: string;
  createdAt: string;
  commentId: string | null;
  sourceUrl: string;
  context: string;
  reason: string;
  relatedJobId: string | null;
  revision: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  outcome: string | null;
  reviewNote: string | null;
};
export const reviewOutcomes = {
  no_action_needed: "No action needed after review",
  handled_on_platform: "Handled separately on Facebook or Instagram",
  duplicate: "Duplicate of an existing report",
  unable_to_verify: "Unable to verify the reported comment",
} as const;
export const reviewFields = z
  .object({
    expectedAdminId: z.string().uuid(),
    jobId: z.string().uuid(),
    revision: z.string().uuid(),
    outcome: z.enum([
      "no_action_needed",
      "handled_on_platform",
      "duplicate",
      "unable_to_verify",
    ]),
    note: text(1000)
      .trim()
      .min(5, "Add a review note of at least five characters."),
  })
  .strict();
