import type { Metadata } from "next";

import {
  requireAdmin,
} from "@/lib/adminPermissions";

import TrustedDevicesClient from "../../../components/Dashboard/Settings/TrustedDevicesClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trusted Devices",
  description:
    "Restricted Burton Pride Admin Portal security page for managing trusted administrator devices.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nositelinkssearchbox: true,
      "max-image-preview": "none",
      "max-snippet": 0,
      "max-video-preview": 0,
    },
  },
  referrer: "no-referrer",
};

export default async function TrustedDevicesPage() {
  await requireAdmin();

  return <TrustedDevicesClient />;
}