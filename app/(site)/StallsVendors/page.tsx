import type { Metadata } from "next";

import StallsVendorsClient from "../components/Client/EventHub/StallsVendorsClient";

export const metadata: Metadata = {
  title: "Stalls & Vendors | Burton Pride",
  description:
    "Apply to attend Burton Pride as a stallholder, food vendor, charity or Community Interest Company.",
  alternates: {
    canonical: "/stalls-vendors",
  },
};

export default function StallsVendorsPage() {
  return <StallsVendorsClient />;
}