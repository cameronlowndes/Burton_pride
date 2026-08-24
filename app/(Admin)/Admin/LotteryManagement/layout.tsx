import type { ReactNode } from "react";
import LotteryManagementSidebar from "../components/rooting/LotteryManagementSidebar";

export default function LotteryManagementLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <LotteryManagementSidebar>
      {children}
    </LotteryManagementSidebar>
  );
}