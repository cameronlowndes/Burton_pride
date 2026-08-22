"use client";

import {
  type Dispatch,
  type SetStateAction,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import type { SponsorBreakdown } from "@/lib/money/types";

import SponsorshipBreakdown from "./SponsorshipBreakdown";

type MoneySponsorSectionProps = {
  selectedYear: string;

  yearlySponsorBreakdown?: SponsorBreakdown[];

  openNewSponsorForm: () => void;

  startEditSponsor: (
    sponsorId: string,
  ) => void;

  setDeleteSponsorId: Dispatch<
    SetStateAction<string | null>
  >;

  /*
   * Kept here so existing parent code does not break.
   * These are not used by SponsorshipBreakdown.
   */
  openLoanRepaymentModal?: () => void;

  openLoanInterestModal?: () => void;
};

function MoneySponsorSection({
  selectedYear,
  yearlySponsorBreakdown,
  openNewSponsorForm,
  startEditSponsor,
  setDeleteSponsorId,
}: MoneySponsorSectionProps) {
  /*
   * ============================================================
   * STABLE CALLBACK REFS
   * ============================================================
   *
   * The Money Management parent can re-render frequently while
   * fields are being typed into.
   *
   * If these functions are recreated on every parent render and
   * SponsorshipBreakdown has effects watching them, its popup can
   * be reset/closed after every keystroke.
   *
   * Keep the newest functions in refs, while giving the child
   * stable callback identities.
   */

  const openNewSponsorFormRef =
    useRef(openNewSponsorForm);

  const startEditSponsorRef =
    useRef(startEditSponsor);

  const setDeleteSponsorIdRef =
    useRef(setDeleteSponsorId);

  /*
   * Keep refs pointing at the newest functions without changing
   * the callback identity passed to SponsorshipBreakdown.
   */
  useEffect(() => {
    openNewSponsorFormRef.current =
      openNewSponsorForm;
  }, [openNewSponsorForm]);

  useEffect(() => {
    startEditSponsorRef.current =
      startEditSponsor;
  }, [startEditSponsor]);

  useEffect(() => {
    setDeleteSponsorIdRef.current =
      setDeleteSponsorId;
  }, [setDeleteSponsorId]);

  /*
   * ============================================================
   * STABLE HANDLERS
   * ============================================================
   */

  const handleOpenNewSponsorForm =
    useCallback(() => {
      openNewSponsorFormRef.current();
    }, []);

  const handleStartEditSponsor =
    useCallback(
      (sponsorId: string) => {
        startEditSponsorRef.current(
          sponsorId,
        );
      },
      [],
    );

  const handleSetDeleteSponsorId =
    useCallback<
      Dispatch<
        SetStateAction<string | null>
      >
    >((value) => {
      setDeleteSponsorIdRef.current(
        value,
      );
    }, []);



  const safeSelectedYear =
    useMemo(() => {
      return String(
        selectedYear ?? "",
      ).trim();
    }, [selectedYear]);

  

  const safeYearlySponsorBreakdown =
    useMemo<SponsorBreakdown[]>(
      () => {
        if (
          !Array.isArray(
            yearlySponsorBreakdown,
          )
        ) {
          return [];
        }

        return yearlySponsorBreakdown;
      },
      [yearlySponsorBreakdown],
    );

  return (
    <SponsorshipBreakdown
      selectedYear={
        safeSelectedYear
      }
      yearlySponsorBreakdown={
        safeYearlySponsorBreakdown
      }
      openNewSponsorForm={
        handleOpenNewSponsorForm
      }
      startEditSponsor={
        handleStartEditSponsor
      }
      setDeleteSponsorId={
        handleSetDeleteSponsorId
      }
    />
  );
}
export default memo(
  MoneySponsorSection,
);