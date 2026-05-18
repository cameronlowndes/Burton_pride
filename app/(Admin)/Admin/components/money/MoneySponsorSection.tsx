"use client";

import type { Dispatch, SetStateAction } from "react";

import type { SponsorBreakdown } from "@/lib/money/types";

import SponsorshipBreakdown from "./SponsorshipBreakdown";

type MoneySponsorSectionProps = {
  selectedYear: string;
  yearlySponsorBreakdown: SponsorBreakdown[];
  openNewSponsorForm: () => void;
  startEditSponsor: (sponsorId: string) => void;
  setDeleteSponsorId: Dispatch<SetStateAction<string | null>>;

  /**
   * Optional loan actions.
   * These connect the loan buttons inside SponsorshipBreakdown.
   * Keep them optional so this component does not break pages
   * that have not added the loan repayment/interest modals yet.
   */
  openLoanRepaymentModal?: (sponsor: SponsorBreakdown) => void;
  openLoanInterestModal?: (sponsor: SponsorBreakdown) => void;
};

export default function MoneySponsorSection({
  selectedYear,
  yearlySponsorBreakdown,
  openNewSponsorForm,
  startEditSponsor,
  setDeleteSponsorId,
}: MoneySponsorSectionProps) {
  return (
    <SponsorshipBreakdown
      selectedYear={selectedYear}
      yearlySponsorBreakdown={yearlySponsorBreakdown}
      openNewSponsorForm={openNewSponsorForm}
      startEditSponsor={startEditSponsor}
      setDeleteSponsorId={setDeleteSponsorId}
    />
  );
}