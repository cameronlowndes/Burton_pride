
import type { Metadata } from "next";

import HelpPage from "../../components/SocialMediaModeration/client/HelpPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Help Page For Burton Pride Social Media Moderation App",
  description:
    "Help page for the Burton Pride Social Media Moderation app.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function SocialMediaModerationHelpPage() {
  return <HelpPage />;
}