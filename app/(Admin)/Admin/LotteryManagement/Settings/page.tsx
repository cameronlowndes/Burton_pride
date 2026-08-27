import type { Metadata } from "next";
import SettingsClient from "../../components/LotteryManagement/Settings/SettingsClient";

export const metadata: Metadata = {
  title: "Settings for Lottery Management | Burton Pride Lottery Management",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

export default function SettingsClientPage() {
  return <SettingsClient />;
}
