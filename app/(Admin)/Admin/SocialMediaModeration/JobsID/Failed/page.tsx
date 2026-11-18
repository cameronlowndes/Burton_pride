import type { Metadata } from "next";
import { requireModerationOperationScreen } from "@/lib/moderation/access";
import FailedJobsClient from "../../../components/SocialMediaModeration/JobsID/FailedJobsClient";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Failed moderation jobs | Burton Pride Admin",
  robots: { index: false, follow: false } };
export default async function Page() {
  await requireModerationOperationScreen("createManual");
  return <FailedJobsClient />;
}
