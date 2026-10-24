import type { Metadata } from "next";
import TicketsClient from "../../components/LotteryManagement/Tickets/TicketsClient";

export const metadata: Metadata = {
  title: "Tickets | Burton Pride Admin",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default function TicketsPage() {
  return <TicketsClient />;
}