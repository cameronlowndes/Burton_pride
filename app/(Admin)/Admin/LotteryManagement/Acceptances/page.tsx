import AcceptancesClient from "../../components/LotteryManagement/Acceptances/AcceptancesClient";

export const metadata = {
  title: "Declarations & Consent | Lottery Management",
  description: "Review recorded lottery declarations and marketing choices.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function LotteryAcceptancesPage() {
  return <AcceptancesClient />;
}
