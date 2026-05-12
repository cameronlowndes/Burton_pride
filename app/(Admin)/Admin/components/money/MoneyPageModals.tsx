"use client";

import type { Dispatch, SetStateAction } from "react";

import type {
  Sponsor,
  SponsorFormState,
} from "@/lib/money/types";

import MoneyModals from "./MoneyModals";

type MoneyPageModalsProps = {
  sponsorFormOpen: boolean;
  editingSponsor: Sponsor | null;
  sponsorForm: SponsorFormState;
  setSponsorForm: Dispatch<SetStateAction<SponsorFormState>>;
  savingSponsor: boolean;
  onCloseSponsorForm: () => void;
  onSaveSponsor: () => Promise<void>;

  deleteYearOpen: boolean;
  selectedYear: string;
  yearTransactionsLength: number;
  deletingYear: boolean;
  deleteYearPassword: string;
  setDeleteYearPassword: Dispatch<SetStateAction<string>>;
  onCloseDeleteYear: () => void;
  onDeleteYear: () => Promise<void>;

  deleteSponsorId: string | null;
  deletingSponsor: boolean;
  setDeleteSponsorId: Dispatch<SetStateAction<string | null>>;
  onDeleteSponsor: () => Promise<void>;

  deleteId: string | null;
  deleting: boolean;
  setDeleteId: Dispatch<SetStateAction<string | null>>;
  onHidePayment: () => Promise<void>;

  deleteAllOpen: boolean;
  transactionsLength: number;
  deletingAll: boolean;
  deleteAllPassword: string;
  setDeleteAllPassword: Dispatch<SetStateAction<string>>;
  onCloseDeleteAll: () => void;
  onDeleteAll: () => Promise<void>;
};

export default function MoneyPageModals({
  sponsorFormOpen,
  editingSponsor,
  sponsorForm,
  setSponsorForm,
  savingSponsor,
  onCloseSponsorForm,
  onSaveSponsor,

  deleteYearOpen,
  selectedYear,
  yearTransactionsLength,
  deletingYear,
  deleteYearPassword,
  setDeleteYearPassword,
  onCloseDeleteYear,
  onDeleteYear,

  deleteSponsorId,
  deletingSponsor,
  setDeleteSponsorId,
  onDeleteSponsor,

  deleteId,
  deleting,
  setDeleteId,
  onHidePayment,

  deleteAllOpen,
  transactionsLength,
  deletingAll,
  deleteAllPassword,
  setDeleteAllPassword,
  onCloseDeleteAll,
  onDeleteAll,
}: MoneyPageModalsProps) {
  return (
    <MoneyModals
      sponsorFormOpen={sponsorFormOpen}
      editingSponsor={editingSponsor}
      sponsorForm={sponsorForm}
      setSponsorForm={setSponsorForm}
      savingSponsor={savingSponsor}
      onCloseSponsorForm={onCloseSponsorForm}
      onSaveSponsor={onSaveSponsor}
      deleteYearOpen={deleteYearOpen}
      selectedYear={selectedYear}
      yearTransactionsLength={yearTransactionsLength}
      deletingYear={deletingYear}
      deleteYearPassword={deleteYearPassword}
      setDeleteYearPassword={setDeleteYearPassword}
      onCloseDeleteYear={onCloseDeleteYear}
      onDeleteYear={onDeleteYear}
      deleteSponsorId={deleteSponsorId}
      deletingSponsor={deletingSponsor}
      onCloseDeleteSponsor={() => setDeleteSponsorId(null)}
      onDeleteSponsor={onDeleteSponsor}
      deleteId={deleteId}
      deleting={deleting}
      onCloseHidePayment={() => setDeleteId(null)}
      onHidePayment={onHidePayment}
      deleteAllOpen={deleteAllOpen}
      transactionsLength={transactionsLength}
      deletingAll={deletingAll}
      deleteAllPassword={deleteAllPassword}
      setDeleteAllPassword={setDeleteAllPassword}
      onCloseDeleteAll={onCloseDeleteAll}
      onDeleteAll={onDeleteAll}
    />
  );
}