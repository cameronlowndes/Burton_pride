import type { Metadata } from "next";

import PublicApplicationTermsClient from "./PublicApplicationTermsClient";

export const metadata: Metadata = {
  title: "Application Terms | Burton Pride",
  description:
    "Read the terms for a Burton Pride event application.",
};

export default async function PublicApplicationTermsPage({
  params,
}: {
  params: Promise<{
    eventId: string;
  }>;
}) {
  const { eventId } = await params;

  return (
    <PublicApplicationTermsClient
      eventId={eventId}
    />
  );
}
