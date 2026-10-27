
import type { Metadata } from "next";

import WelcomePageClient from "../components/SoicalMediaModeration/client/WelcomePage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome To Burton Pride Social Media Moderation App",
  description:
    "Welcome page for the Burton Pride Social Media Moderation app.",

  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function SocialMediaModerationWelcomePage() {
  return <WelcomePageClient />;
}