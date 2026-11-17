import type { Metadata } from "next";
import { developmentScreen } from "@/lib/development-requests/server";
import DevelopmentRequests from "../components/Dashboard/Settings/DevelopmentRequests/DevelopmentRequestsClient";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Development Requests", robots: { index: false, follow: false } };
export default async function DevelopmentRequestsPage() {
  await developmentScreen();
  return <DevelopmentRequests />;
}
