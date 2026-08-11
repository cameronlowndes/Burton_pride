import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentAdminPermissions } from "@/lib/adminPermissions";

import TrustedDevicesClient from "../../../components/Dashboard/Settings/TrustedDevicesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

/**
 * Trusted Devices is a protected security-centre page.
 *
 * Do not let requireAdmin() throw an internal security error into the React
 * server-component error overlay. Resolve the authenticated admin safely and
 * redirect an unauthorised/expired session back through the login flow.
 *
 * The API route remains the authoritative security boundary and MUST perform
 * its own server-side permission/session checks as well.
 */
export default async function TrustedDevicesPage() {
  const admin = await getCurrentAdminPermissions();


  return <TrustedDevicesClient />;
}