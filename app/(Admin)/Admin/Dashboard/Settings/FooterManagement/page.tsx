import type { Metadata } from "next";

import FooterManagement from "../../../components/Dashboard/Settings/PageEditor/FooterManagementPage";

export const metadata: Metadata = {
  title: "Footer Management",
  description:
    "This page allow you to management the public website Footer",
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

export default function FooterManagementPage() {
  return <FooterManagement />;
}