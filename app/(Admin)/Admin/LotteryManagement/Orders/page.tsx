import type { Metadata } from "next";
import OrdersClient from "../../components/LotteryManagement/Orders/OrdersClient";

export const metadata: Metadata = {
  title: "Orders & Entries | Burton Pride Admin",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  referrer: "no-referrer",
};

export default function OrdersPage() {
  return <OrdersClient />;
}