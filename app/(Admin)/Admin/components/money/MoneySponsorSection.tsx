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