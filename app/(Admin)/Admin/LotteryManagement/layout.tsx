import type { ReactNode } from "react";
import LotteryManagementSidebar from "../components/rooting/LotteryManagementSidebar";
import Watermark from "../components/LotteryManagement/Watermark";

export default function LotteryManagementLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <LotteryManagementSidebar>
      {children}
      <Watermark />
    </LotteryManagementSidebar>
  );
}