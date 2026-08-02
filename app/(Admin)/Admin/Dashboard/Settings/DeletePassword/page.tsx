import type { Metadata } from "next";

import DeletePasswordClient from "../../../components/Dashboard/Settings/DeletePasswordClient";

export const metadata: Metadata = {
  title: "Delete Password Settings",
  description:
    "Restricted Burton Pride Admin Portal page for managing the high-risk money deletion password.",
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

export default function DeletePasswordPage() {
  return <DeletePasswordClient />;
}