import type { Metadata } from "next";
import { developmentScreen } from "@/lib/development-requests/server";
import DevelopmentRequestDetails from "../../components/Dashboard/Settings/DevelopmentRequests/DevelopmentRequestDetails";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Development Request", robots: { index: false, follow: false } };
export default async function DevelopmentRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await developmentScreen();
  const { id } = await params;
  return <DevelopmentRequestDetails requestId={id} />;
}
