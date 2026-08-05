"use client";

import type {
  ChangeEvent,
  FormEvent,
  ReactNode,
} from "react";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  HeartHandshake,
  Home,
  Loader2,
  ShieldCheck,
  Sparkles,
  Store,
  Upload,
  Utensils,
  X,
  Zap,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { createPortal } from "react-dom";

type ApplicationType =
  | "stallholder"
  | "food_vendor"
  | "charity"
  | "cic";

type PitchType =
  | "standard"
  | "double";

type ActiveEvent = {
  id: string;
  event_name: string;
  event_year: number | null;
  event_date: string | null;
};

type UploadField =
  | "publicLiabilityDocumentPath"
  | "foodHygieneDocumentPath"
  | "gasSafetyDocumentPath"
  | "charityOrCicProofPath";

type FormState = {
  eventId: string;

  applicationType: ApplicationType;
  pitchType: PitchType;

  organisationName: string;
  tradingName: string;

  contactName: string;
  contactEmail: string;
  contactPhone: string;

  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;

  website: string;
  socialMedia: string;

  description: string;
  productsServices: string;

  gazeboWidthMetres: string;
  gazeboDepthMetres: string;

  electricityRequired: boolean;
  electricityDetails: string;

  publicLiabilityInsurance: boolean;
  publicLiabilityExpiryDate: string;
  publicLiabilityDocumentPath: string;

  foodHygieneRating: string;
  foodRegistrationAuthority: string;
  foodHygieneDocumentPath: string;

  usesGas: boolean;
  gasSafetyDocumentPath: string;

  usesGenerator: boolean;
  generatorDetails: string;

  charityNumber: string;
  companyNumber: string;
  charityOrCicProofPath: string;

  accessibilityRequirements: string;
  additionalInformation: string;

  termsAccepted: boolean;
  dataProcessingAccepted: boolean;
};

type SubmissionResponse = {
  success?: boolean;
  reference?: string;
  feePence?: number;
  paymentStatus?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const initialForm: FormState = {
  eventId: "",

  applicationType: "stallholder",
  pitchType: "standard",

  organisationName: "",
  tradingName: "",

  contactName: "",
  contactEmail: "",
  contactPhone: "",

  addressLine1: "",
  addressLine2: "",
  townCity: "",
  county: "",
  postcode: "",

  website: "",
  socialMedia: "",

  description: "",
  productsServices: "",

  gazeboWidthMetres: "",
  gazeboDepthMetres: "",

  electricityRequired: false,
  electricityDetails: "",

  publicLiabilityInsurance: false,
  publicLiabilityExpiryDate: "",
  publicLiabilityDocumentPath: "",

  foodHygieneRating: "",
  foodRegistrationAuthority: "",
  foodHygieneDocumentPath: "",

  usesGas: false,
  gasSafetyDocumentPath: "",

  usesGenerator: false,
  generatorDetails: "",

  charityNumber: "",
  companyNumber: "",
  charityOrCicProofPath: "",

  accessibilityRequirements: "",
  additionalInformation: "",

  termsAccepted: false,
  dataProcessingAccepted: false,
};

const inputClass = `
  mt-2
  h-12
  w-full
  rounded-2xl
  border
  border-slate-300
  bg-white
  px-4
  text-sm
  font-medium
  text-slate-950
  shadow-sm
  outline-none
  transition
  placeholder:text-slate-400
  hover:border-slate-400
  focus:border-purple-500
  focus:ring-4
  focus:ring-purple-500/15

  dark:border-white/20
  dark:bg-white/[0.07]
  dark:text-white
  dark:placeholder:text-white/35
  dark:hover:border-white/25
  dark:focus:border-purple-300/60
`;

const textareaClass = `
  mt-2
  min-h-36
  w-full
  resize-y
  rounded-2xl
  border
  border-slate-300
  bg-white
  p-4
  text-sm
  font-medium
  text-slate-950
  shadow-sm
  outline-none
  transition
  placeholder:text-slate-400
  hover:border-slate-400
  focus:border-purple-500
  focus:ring-4
  focus:ring-purple-500/15

  dark:border-white/20
  dark:bg-white/[0.07]
  dark:text-white
  dark:placeholder:text-white/35
  dark:hover:border-white/25
  dark:focus:border-purple-300/60
`;

const sectionClass = `
  rounded-[2rem]
  border
  border-white/40
  bg-white/92
  p-5
  text-slate-950
  shadow-[0_24px_80px_-32px_rgba(76,29,149,0.38)]
  backdrop-blur-xl
  sm:p-8

  dark:border-white/15
  dark:bg-[#0b1020]
  dark:text-white
  dark:shadow-2xl
  dark:shadow-black/20
`;

async function readJsonResponse<T>(
  response: Response,
): Promise<T> {
  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      `The server returned an unexpected response (${response.status}).`,
    );
  }

  return (await response.json()) as T;
}

function formatMoney(pence: number) {
  if (pence === 0) {
    return "Free";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

function formatEventDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function StallsVendorsClient() {
  const [form, setForm] =
    useState<FormState>(initialForm);

  const [activeEvent, setActiveEvent] =
    useState<ActiveEvent | null>(null);

  const [loadingEvent, setLoadingEvent] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [uploadingField, setUploadingField] =
    useState<UploadField | null>(null);

  const [error, setError] =
    useState("");

  const [fieldErrors, setFieldErrors] =
    useState<Record<string, string[]>>({});

  const [successReference, setSuccessReference] =
    useState("");

  const [applicationPickerOpen, setApplicationPickerOpen] =
    useState(false);

  const [applicationFormOpen, setApplicationFormOpen] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveEvent() {
      setLoadingEvent(true);
      setError("");

      try {
        const response = await fetch(
          "/api/event-hub/stalls-vendors",
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const payload =
          await readJsonResponse<{
            event?: ActiveEvent;
            error?: string;
          }>(response);

        if (!response.ok) {
          throw new Error(
            payload.error ||
              "Applications are not currently available.",
          );
        }

        if (cancelled) {
          return;
        }

        if (!payload.event) {
          throw new Error(
            "No active Burton Pride event was returned.",
          );
        }

        const event = payload.event;

        setActiveEvent(event);

        setForm((current) => ({
          ...current,
          eventId: event.id,
        }));
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "The event could not be loaded.",
        );
      } finally {
        if (!cancelled) {
          setLoadingEvent(false);
        }
      }
    }

    void loadActiveEvent();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !applicationPickerOpen &&
      !applicationFormOpen
    ) {
      return;
    }

    const originalOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (applicationFormOpen) {
        setApplicationFormOpen(false);
        return;
      }

      setApplicationPickerOpen(false);
    }

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.body.style.overflow =
        originalOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [
    applicationPickerOpen,
    applicationFormOpen,
  ]);

  const feePence = useMemo(() => {
    if (
      form.applicationType === "charity" ||
      form.applicationType === "cic"
    ) {
      return 0;
    }

    if (
      form.applicationType === "food_vendor"
    ) {
      return 9500;
    }

    return form.pitchType === "double"
      ? 5500
      : 2500;
  }, [
    form.applicationType,
    form.pitchType,
  ]);

  const isCommunityOrganisation =
    form.applicationType === "charity" ||
    form.applicationType === "cic";

  const isFoodVendor =
    form.applicationType === "food_vendor";

  function updateField<
    K extends keyof FormState,
  >(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = {
        ...current,
      };

      delete next[field];

      return next;
    });
  }

  function selectApplicationType(
    applicationType: ApplicationType,
  ) {
    setForm((current) => ({
      ...current,
      applicationType,
      pitchType:
        applicationType === "stallholder"
          ? current.pitchType
          : "standard",
    }));

    setError("");
    setFieldErrors({});
  }

  function chooseApplication(
    applicationType: ApplicationType,
    pitchType: PitchType = "standard",
  ) {
    setForm((current) => ({
      ...current,
      applicationType,
      pitchType,
    }));

    setError("");
    setFieldErrors({});
    setApplicationPickerOpen(false);
    setApplicationFormOpen(true);
  }

  function changeApplicationType() {
    setApplicationFormOpen(false);
    setApplicationPickerOpen(true);
  }

  async function uploadDocument(
    field: UploadField,
    documentType:
      | "public_liability"
      | "food_hygiene"
      | "gas_safety"
      | "charity_cic_proof",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingField(field);
    setError("");

    try {
      const body = new FormData();

      body.append("file", file);
      body.append(
        "documentType",
        documentType,
      );

      const response = await fetch(
        "/api/event-hub/stalls-vendors/upload",
        {
          method: "POST",
          body,
        },
      );

      const payload =
        await readJsonResponse<{
          path?: string;
          error?: string;
        }>(response);

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "The document could not be uploaded.",
        );
      }

      updateField(
        field,
        String(payload.path || ""),
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The document could not be uploaded.",
      );
    } finally {
      setUploadingField(null);
      event.target.value = "";
    }
  }

  function returnToApplications() {
    setSuccessReference("");
    setApplicationFormOpen(false);
    setApplicationPickerOpen(false);
    setError("");
    setFieldErrors({});

    setForm({
      ...initialForm,
      eventId: activeEvent?.id || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function submitApplication(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!form.eventId) {
      setError(
        "The active event has not loaded. Please refresh the page.",
      );

      return;
    }

    setSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      const response = await fetch(
        "/api/event-hub/stalls-vendors",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            ...form,

            gazeboWidthMetres:
              form.gazeboWidthMetres.trim() ===
              ""
                ? null
                : Number(
                    form.gazeboWidthMetres,
                  ),

            gazeboDepthMetres:
              form.gazeboDepthMetres.trim() ===
              ""
                ? null
                : Number(
                    form.gazeboDepthMetres,
                  ),
          }),
        },
      );

      const payload =
        await readJsonResponse<SubmissionResponse>(
          response,
        );

      if (!response.ok) {
        setFieldErrors(
          payload.fieldErrors || {},
        );

        throw new Error(
          payload.error ||
            "Your application could not be submitted.",
        );
      }

      setSuccessReference(
        payload.reference || "",
      );

      setApplicationFormOpen(false);
      setApplicationPickerOpen(false);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Your application could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (successReference) {
    return (
      <main className="relative min-h-screen overflow-hidden px-4 pb-24 pt-32 text-slate-950 dark:text-white sm:px-6 sm:pt-36 lg:px-8">
        <div className="relative mx-auto max-w-2xl">
          <div className="rounded-[2rem] border border-emerald-300/25 bg-emerald-500/10 p-7 text-center shadow-2xl backdrop-blur-xl sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/15">
              <CheckCircle2 className="h-11 w-11 text-emerald-700 dark:text-emerald-300" />
            </div>

            <h1 className="mt-6 text-3xl font-black sm:text-4xl">
              Application submitted
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-700 dark:text-white/75">
              Your application has been sent
              to the Burton Pride Event Hub
              and is now waiting for review
              and approval.
            </p>

            <div className="mt-7 rounded-2xl border border-white/10 bg-black/25 p-5">
              <p className="text-sm font-medium text-slate-600 dark:text-white/55">
                Application reference
              </p>

              <p className="mt-2 break-words text-2xl font-black text-emerald-700 dark:text-emerald-200">
                {successReference}
              </p>
            </div>

            <p className="mt-6 text-sm leading-6 text-slate-600 dark:text-white/60">
              Keep this reference safe. A
              confirmation email should also
              be sent to the email address
              entered on the form.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={returnToApplications}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-3 font-black text-white shadow-lg shadow-purple-950/25 transition hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-purple-500/20"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to applications
              </button>

              <a
                href="/"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-800 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-purple-500/20 dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.1]"
              >
                <Home className="h-5 w-5" />
                Return to homepage
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 pb-24 pt-32 text-slate-950 dark:text-white sm:px-6 sm:pt-36 lg:px-8">
      <div className="relative mx-auto max-w-6xl">
        <header className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-sm font-black text-pink-700 shadow-lg shadow-purple-900/10 backdrop-blur dark:border-white/15 dark:bg-black/25 dark:text-pink-200">
              <Sparkles className="h-4 w-4" />
              Burton Pride 2027 applications
            </div>

            <h1 className="mt-6 text-5xl font-black tracking-[-0.04em] text-white drop-shadow-[0_3px_14px_rgba(88,28,135,0.55)] sm:text-7xl">
              Join us for Burton Pride 2027
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-base font-semibold leading-8 text-white/95 drop-shadow sm:text-lg">
              We are inviting local businesses, food vendors, charities
              and Community Interest Companies to be part of Burton Pride 2027.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2rem] border border-white/40 bg-white/90 p-6 text-slate-950 shadow-[0_24px_80px_-32px_rgba(76,29,149,0.45)] backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-slate-950/75 dark:text-white">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-700 dark:text-purple-200">
                Get involved
              </p>

              <h2 className="mt-3 text-3xl font-black">
                Bring your organisation to Pride
              </h2>

              <p className="mt-4 leading-7 text-slate-700 dark:text-white/70">
                    Burton Pride is a community-led Pride, run by the community, for the community. 
                    We are a grassroots organisation that believes in putting local people first.
                    Come and celebrate Pride with us!

              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <HeroInfo
                  title="Local businesses"
                  text="Standard and double trading pitches."
                />
                <HeroInfo
                  title="Food vendors"
                  text="Dedicated food and drink pitch applications."
                />
                <HeroInfo
                  title="Charities"
                  text="Free places with proof of registration."
                />
                <HeroInfo
                  title="Community Interest Companies"
                  text="Free places for verified C.I.C.s."
                />
              </div>

              {activeEvent ? (
                <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-purple-300/20 dark:bg-purple-500/10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-black">
                        {activeEvent.event_name}
                      </p>
                      {formatEventDate(activeEvent.event_date) ? (
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-white/60">
                          {formatEventDate(activeEvent.event_date)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                    Applications open
                  </span>
                </div>
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-white/40 bg-white/90 p-6 text-slate-950 shadow-[0_24px_80px_-32px_rgba(76,29,149,0.45)] backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-slate-950/75 dark:text-white">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-pink-700 dark:text-pink-200">
                2027 stall prices
              </p>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                <PriceRow label="Standard stall" price="£25" />
                <PriceRow label="Double pitch" price="£55" />
                <PriceRow label="Food vendor" price="£95" />
                <PriceRow label="Charity" price="Free" />
                <PriceRow label="C.I.C." price="Free" last />
              </div>

              <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-medium leading-6 text-slate-700 dark:bg-white/[0.06] dark:text-white/65">
                Charity and C.I.C. applications must include evidence of
                registration. All applications are reviewed before a place is confirmed.
              </div>

              <button
                type="button"
                onClick={() =>
                  setApplicationPickerOpen(true)
                }
                className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-5 py-3 text-center font-black text-white shadow-lg shadow-purple-900/20 transition hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-purple-300/40"
              >
                Start your application
              </button>
            </div>
          </div>
        </header>

        {loadingEvent ? (
          <div className="mt-10 flex items-center justify-center gap-3 rounded-2xl border border-white/40 bg-white/90 p-6 font-semibold text-slate-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-black/20 dark:text-white/70">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading the active event
          </div>
        ) : null}




      </div>

        {applicationFormOpen &&
        !loadingEvent &&
        activeEvent
          ? createPortal(
              <div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/85 p-2 backdrop-blur-md sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-form-title"
          >
            <div className="relative flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] border border-white/15 bg-slate-100 text-slate-950 shadow-2xl dark:bg-[#070b16] dark:text-white">
              <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#070b16]/95 sm:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700 dark:bg-purple-500/15 dark:text-purple-200">
                      <Store className="h-4 w-4" />
                      Burton Pride application
                    </div>

                    <h2
                      id="application-form-title"
                      className="mt-2 text-2xl font-black sm:text-3xl"
                    >
                      Complete your application
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold">
                      <span className="rounded-full bg-pink-100 px-3 py-1 text-pink-700 dark:bg-pink-500/15 dark:text-pink-200">
                        {form.applicationType === "stallholder"
                          ? form.pitchType === "double"
                            ? "Double pitch"
                            : "Standard pitch"
                          : form.applicationType === "food_vendor"
                            ? "Food vendor"
                            : form.applicationType === "charity"
                              ? "Registered charity"
                              : "Community Interest Company"}
                      </span>

                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                        {formatMoney(feePence)}
                      </span>

                      <button
                        type="button"
                        onClick={changeApplicationType}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-purple-700 transition hover:bg-purple-50 dark:border-white/15 dark:bg-white/[0.06] dark:text-purple-200 dark:hover:bg-white/[0.1]"
                      >
                        Change application
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setApplicationFormOpen(false)
                    }
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-purple-500/20 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.12]"
                    aria-label="Close application form"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-24 pt-5 sm:px-6 sm:pb-28 sm:pt-7">
                {error ? (
                  <div
                    role="alert"
                    className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800 dark:border-red-300/25 dark:bg-red-500/10 dark:text-red-100"
                  >
                    {error}
                  </div>
                ) : null}

        {!loadingEvent &&
        activeEvent ? (
          <form
            className="space-y-6"
            onSubmit={
              submitApplication
            }
          >
            <section
              className={sectionClass}
            >
              <SectionHeading
                icon={
                  <Store className="h-6 w-6" />
                }
                title="Choose your application"
                description="Select the correct pitch and application type."
              />

              {form.applicationType ===
              "stallholder" ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <ChoiceButton
                    selected={
                      form.pitchType ===
                      "standard"
                    }
                    title="Standard pitch"
                    price="£25"
                    description="One normal stall pitch."
                    onClick={() =>
                      updateField(
                        "pitchType",
                        "standard",
                      )
                    }
                  />

                  <ChoiceButton
                    selected={
                      form.pitchType ===
                      "double"
                    }
                    title="Double pitch"
                    price="£55"
                    description="Extra space for a larger stall."
                    onClick={() =>
                      updateField(
                        "pitchType",
                        "double",
                      )
                    }
                  />
                </div>
              ) : null}

              {isCommunityOrganisation ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <ChoiceButton
                    selected={
                      form.applicationType ===
                      "charity"
                    }
                    title="Registered charity"
                    price="Free"
                    description="Proof of registered charity status is required."
                    onClick={() =>
                      selectApplicationType(
                        "charity",
                      )
                    }
                  />

                  <ChoiceButton
                    selected={
                      form.applicationType ===
                      "cic"
                    }
                    title="Community Interest Company"
                    price="Free"
                    description="Proof of C.I.C. status is required."
                    onClick={() =>
                      selectApplicationType(
                        "cic",
                      )
                    }
                  />
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-purple-200 bg-purple-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-purple-300/15 dark:bg-purple-500/10">
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-white/55">
                    Application fee
                  </p>

                  <p className="mt-1 text-3xl font-black">
                    {formatMoney(
                      feePence,
                    )}
                  </p>
                </div>

                <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-white/60">
                  Submitting the form does
                  not automatically approve
                  or confirm your place.
                </p>
              </div>
            </section>

            <section
              className={sectionClass}
            >
              <SectionHeading
                icon={
                  <Building2 className="h-6 w-6" />
                }
                title="Organisation details"
                description="Tell us who is applying and how we can contact you."
              />

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Organisation name"
                  required
                  value={
                    form.organisationName
                  }
                  error={
                    fieldErrors
                      .organisationName?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "organisationName",
                      value,
                    )
                  }
                />

                <TextField
                  label="Trading name"
                  value={
                    form.tradingName
                  }
                  error={
                    fieldErrors
                      .tradingName?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "tradingName",
                      value,
                    )
                  }
                />

                <TextField
                  label="Contact name"
                  required
                  value={
                    form.contactName
                  }
                  error={
                    fieldErrors
                      .contactName?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "contactName",
                      value,
                    )
                  }
                />

                <TextField
                  label="Email address"
                  required
                  type="email"
                  value={
                    form.contactEmail
                  }
                  error={
                    fieldErrors
                      .contactEmail?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "contactEmail",
                      value,
                    )
                  }
                />

                <TextField
                  label="Telephone number"
                  required
                  type="tel"
                  value={
                    form.contactPhone
                  }
                  error={
                    fieldErrors
                      .contactPhone?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "contactPhone",
                      value,
                    )
                  }
                />

                <TextField
                  label="Website"
                  type="url"
                  placeholder="https://"
                  value={form.website}
                  error={
                    fieldErrors
                      .website?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "website",
                      value,
                    )
                  }
                />

                <div className="sm:col-span-2">
                  <TextField
                    label="Social media"
                    placeholder="Add your social media page or username"
                    value={
                      form.socialMedia
                    }
                    error={
                      fieldErrors
                        .socialMedia?.[0]
                    }
                    onChange={(value) =>
                      updateField(
                        "socialMedia",
                        value,
                      )
                    }
                  />
                </div>
              </div>
            </section>

            <section
              className={sectionClass}
            >
              <SectionHeading
                icon={
                  <Building2 className="h-6 w-6" />
                }
                title="Address"
                description="Enter the registered or trading address."
              />

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <TextField
                    label="Address line 1"
                    required
                    value={
                      form.addressLine1
                    }
                    error={
                      fieldErrors
                        .addressLine1?.[0]
                    }
                    onChange={(value) =>
                      updateField(
                        "addressLine1",
                        value,
                      )
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <TextField
                    label="Address line 2"
                    value={
                      form.addressLine2
                    }
                    error={
                      fieldErrors
                        .addressLine2?.[0]
                    }
                    onChange={(value) =>
                      updateField(
                        "addressLine2",
                        value,
                      )
                    }
                  />
                </div>

                <TextField
                  label="Town or city"
                  required
                  value={form.townCity}
                  error={
                    fieldErrors
                      .townCity?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "townCity",
                      value,
                    )
                  }
                />

                <TextField
                  label="County"
                  value={form.county}
                  error={
                    fieldErrors
                      .county?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "county",
                      value,
                    )
                  }
                />

                <TextField
                  label="Postcode"
                  required
                  value={
                    form.postcode
                  }
                  error={
                    fieldErrors
                      .postcode?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "postcode",
                      value.toUpperCase(),
                    )
                  }
                />
              </div>
            </section>

            <section
              className={sectionClass}
            >
              <SectionHeading
                icon={
                  <Store className="h-6 w-6" />
                }
                title="About your stall"
                description="Explain what you do and what you will bring to the event."
              />

              <div className="mt-6 space-y-5">
                <TextAreaField
                  label="Tell us about your organisation"
                  required
                  value={
                    form.description
                  }
                  error={
                    fieldErrors
                      .description?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "description",
                      value,
                    )
                  }
                />

                <TextAreaField
                  label="What will you sell, provide or promote?"
                  required
                  value={
                    form.productsServices
                  }
                  error={
                    fieldErrors
                      .productsServices?.[0]
                  }
                  onChange={(value) =>
                    updateField(
                      "productsServices",
                      value,
                    )
                  }
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    label="Gazebo width in metres"
                    type="number"
                    min="0"
                    step="0.1"
                    value={
                      form.gazeboWidthMetres
                    }
                    onChange={(value) =>
                      updateField(
                        "gazeboWidthMetres",
                        value,
                      )
                    }
                  />

                  <TextField
                    label="Gazebo depth in metres"
                    type="number"
                    min="0"
                    step="0.1"
                    value={
                      form.gazeboDepthMetres
                    }
                    onChange={(value) =>
                      updateField(
                        "gazeboDepthMetres",
                        value,
                      )
                    }
                  />
                </div>
              </div>
            </section>

            <section
              className={sectionClass}
            >
              <SectionHeading
                icon={
                  <ShieldCheck className="h-6 w-6" />
                }
                title="Safety and documents"
                description="Upload the documents required for your application."
              />

              <div className="mt-6 space-y-6">
                <CheckboxField
                  checked={
                    form.publicLiabilityInsurance
                  }
                  label="I have public liability insurance"
                  onChange={(checked) =>
                    updateField(
                      "publicLiabilityInsurance",
                      checked,
                    )
                  }
                />

                {form.publicLiabilityInsurance ? (
                  <>
                    <TextField
                      label="Public liability expiry date"
                      type="date"
                      value={
                        form.publicLiabilityExpiryDate
                      }
                      onChange={(value) =>
                        updateField(
                          "publicLiabilityExpiryDate",
                          value,
                        )
                      }
                    />

                    <DocumentUpload
                      label="Public liability insurance"
                      uploaded={
                        form.publicLiabilityDocumentPath !==
                        ""
                      }
                      loading={
                        uploadingField ===
                        "publicLiabilityDocumentPath"
                      }
                      onChange={(event) =>
                        uploadDocument(
                          "publicLiabilityDocumentPath",
                          "public_liability",
                          event,
                        )
                      }
                    />
                  </>
                ) : null}

                {isFoodVendor ? (
                  <div className="space-y-5 rounded-2xl border border-orange-200 bg-orange-50 p-5 dark:border-orange-300/15 dark:bg-orange-500/10">
                    <div>
                      <h3 className="font-black text-orange-800 dark:text-orange-100">
                        Food vendor
                        information
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-white/60">
                        Food vendors must
                        provide food hygiene
                        evidence before
                        approval.
                      </p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <TextField
                        label="Food hygiene rating"
                        value={
                          form.foodHygieneRating
                        }
                        onChange={(value) =>
                          updateField(
                            "foodHygieneRating",
                            value,
                          )
                        }
                      />

                      <TextField
                        label="Registration authority"
                        value={
                          form.foodRegistrationAuthority
                        }
                        onChange={(value) =>
                          updateField(
                            "foodRegistrationAuthority",
                            value,
                          )
                        }
                      />
                    </div>

                    <DocumentUpload
                      label="Food hygiene evidence"
                      required
                      uploaded={
                        form.foodHygieneDocumentPath !==
                        ""
                      }
                      loading={
                        uploadingField ===
                        "foodHygieneDocumentPath"
                      }
                      onChange={(event) =>
                        uploadDocument(
                          "foodHygieneDocumentPath",
                          "food_hygiene",
                          event,
                        )
                      }
                    />
                  </div>
                ) : null}

                <CheckboxField
                  checked={
                    form.usesGas
                  }
                  label="I will use gas equipment"
                  onChange={(checked) =>
                    updateField(
                      "usesGas",
                      checked,
                    )
                  }
                />

                {form.usesGas ? (
                  <DocumentUpload
                    label="Gas safety certificate"
                    required
                    uploaded={
                      form.gasSafetyDocumentPath !==
                      ""
                    }
                    loading={
                      uploadingField ===
                      "gasSafetyDocumentPath"
                    }
                    onChange={(event) =>
                      uploadDocument(
                        "gasSafetyDocumentPath",
                        "gas_safety",
                        event,
                      )
                    }
                  />
                ) : null}

                <CheckboxField
                  checked={
                    form.usesGenerator
                  }
                  label="I will use a generator"
                  onChange={(checked) =>
                    updateField(
                      "usesGenerator",
                      checked,
                    )
                  }
                />

                {form.usesGenerator ? (
                  <TextAreaField
                    label="Generator details"
                    required
                    value={
                      form.generatorDetails
                    }
                    onChange={(value) =>
                      updateField(
                        "generatorDetails",
                        value,
                      )
                    }
                  />
                ) : null}

               

                {form.electricityRequired ? (
                  <TextAreaField
                    label="Electricity requirements"
                    required
                    value={
                      form.electricityDetails
                    }
                    onChange={(value) =>
                      updateField(
                        "electricityDetails",
                        value,
                      )
                    }
                  />
                ) : null}
              </div>
            </section>

            {isCommunityOrganisation ? (
              <section
                className={
                  sectionClass
                }
              >
                <SectionHeading
                  icon={
                    <HeartHandshake className="h-6 w-6" />
                  }
                  title="Charity or C.I.C. evidence"
                  description="Free pitches require evidence of your organisation status."
                />

                <div className="mt-6 space-y-5">
                  {form.applicationType ===
                  "charity" ? (
                    <TextField
                      label="Registered charity number"
                      required
                      value={
                        form.charityNumber
                      }
                      error={
                        fieldErrors
                          .charityNumber?.[0]
                      }
                      onChange={(value) =>
                        updateField(
                          "charityNumber",
                          value,
                        )
                      }
                    />
                  ) : (
                    <TextField
                      label="C.I.C. company number"
                      required
                      value={
                        form.companyNumber
                      }
                      error={
                        fieldErrors
                          .companyNumber?.[0]
                      }
                      onChange={(value) =>
                        updateField(
                          "companyNumber",
                          value,
                        )
                      }
                    />
                  )}

                  <DocumentUpload
                    label="Organisation registration evidence"
                    required
                    uploaded={
                      form.charityOrCicProofPath !==
                      ""
                    }
                    loading={
                      uploadingField ===
                      "charityOrCicProofPath"
                    }
                    onChange={(event) =>
                      uploadDocument(
                        "charityOrCicProofPath",
                        "charity_cic_proof",
                        event,
                      )
                    }
                  />
                </div>
              </section>
            ) : null}

            <section
              className={sectionClass}
            >
              <SectionHeading
                icon={
                  <FileCheck2 className="h-6 w-6" />
                }
                title="Additional information"
                description="Tell us about any adjustments or other information."
              />

              <div className="mt-6 space-y-5">
                <TextAreaField
                  label="Accessibility requirements"
                  value={
                    form.accessibilityRequirements
                  }
                  onChange={(value) =>
                    updateField(
                      "accessibilityRequirements",
                      value,
                    )
                  }
                />

                <TextAreaField
                  label="Anything else we should know?"
                  value={
                    form.additionalInformation
                  }
                  onChange={(value) =>
                    updateField(
                      "additionalInformation",
                      value,
                    )
                  }
                />
              </div>
            </section>

            <section
              className={sectionClass}
            >
              <SectionHeading
                icon={
                  <Check className="h-6 w-6" />
                }
                title="Declaration"
                description="Review the fee and confirm the declarations."
              />

              <div className="mt-6 space-y-4">
                <CheckboxField
                  required
                  checked={
                    form.termsAccepted
                  }
                  label="I confirm that the information supplied is accurate and I accept the Burton Pride Stalls & Vendors terms."
                  onChange={(checked) =>
                    updateField(
                      "termsAccepted",
                      checked,
                    )
                  }
                />

                <CheckboxField
                  required
                  checked={
                    form.dataProcessingAccepted
                  }
                  label="I agree that Burton Pride may process this information to manage this application."
                  onChange={(checked) =>
                    updateField(
                      "dataProcessingAccepted",
                      checked,
                    )
                  }
                />
              </div>

              <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-black/20">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-white/55">
                      Total application fee
                    </p>

                    <p className="mt-1 text-3xl font-black">
                      {formatMoney(
                        feePence,
                      )}
                    </p>
                  </div>

                  <div className="flex max-w-md items-start gap-3 text-sm leading-6 text-slate-600 dark:text-white/60">
                    <Zap className="mt-1 h-4 w-4 shrink-0 text-yellow-300" />

                    <p>
                      Payment is not taken
                      on this page. The
                      application will first
                      be sent to the Event
                      Hub for approval.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  submitting ||
                  uploadingField !==
                    null
                }
                className="
                  mt-7
                  flex
                  min-h-14
                  w-full
                  items-center
                  justify-center
                  gap-3
                  rounded-2xl
                  bg-gradient-to-r
                  from-pink-500
                  via-purple-500
                  to-blue-500
                  px-6
                  py-4
                  text-base
                  font-black
                  text-white
                  shadow-xl
                  shadow-purple-950/30
                  transition
                  hover:scale-[1.01]
                  hover:brightness-110
                  focus:outline-none
                  focus:ring-2
                  focus:ring-pink-300
                  focus:ring-offset-2
                  focus:ring-offset-transparent
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  disabled:hover:scale-100
                "
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Submitting application
                  </>
                ) : (
                  <>
                    Submit application
                    <ChevronRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </section>
          </form>
        ) : null}
              </div>
            </div>
          </div>,
              document.body,
            )
          : null}

        {applicationPickerOpen
          ? createPortal(
              <div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="application-picker-title"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget
              ) {
                setApplicationPickerOpen(false);
              }
            }}
          >
            <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/40 bg-white p-5 text-slate-950 shadow-2xl sm:p-8 dark:border-white/10 dark:bg-slate-950 dark:text-white">
              <button
                type="button"
                onClick={() =>
                  setApplicationPickerOpen(false)
                }
                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-purple-500/20 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.12]"
                aria-label="Close application options"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="pr-14">
                <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 text-xs font-black uppercase tracking-[0.15em] text-purple-700 dark:bg-purple-500/15 dark:text-purple-200">
                  <Sparkles className="h-4 w-4" />
                  Choose your application
                </div>

                <h2
                  id="application-picker-title"
                  className="mt-4 text-3xl font-black tracking-tight sm:text-4xl"
                >
                  What would you like to apply for?
                </h2>

                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600 dark:text-white/60 sm:text-base">
                  Select one option below. The complete application
                  form will then open in a large, easy-to-read popup.
                </p>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <ApplicationPickerCard
                  title="Standard stall"
                  price="£25"
                  description="One normal trading pitch for a business or stallholder."
                  icon={<Store className="h-7 w-7" />}
                  onClick={() =>
                    chooseApplication(
                      "stallholder",
                      "standard",
                    )
                  }
                />

                <ApplicationPickerCard
                  title="Double pitch"
                  price="£55"
                  description="A larger double-width trading space."
                  icon={<Store className="h-7 w-7" />}
                  onClick={() =>
                    chooseApplication(
                      "stallholder",
                      "double",
                    )
                  }
                />

                <ApplicationPickerCard
                  title="Food vendor"
                  price="£95"
                  description="For businesses selling food or drink at the event."
                  icon={<Utensils className="h-7 w-7" />}
                  onClick={() =>
                    chooseApplication(
                      "food_vendor",
                    )
                  }
                />

                <ApplicationPickerCard
                  title="Registered charity"
                  price="Free"
                  description="A free pitch with proof of registered charity status."
                  icon={
                    <HeartHandshake className="h-7 w-7" />
                  }
                  onClick={() =>
                    chooseApplication("charity")
                  }
                />

                <ApplicationPickerCard
                  title="Community Interest Company"
                  price="Free"
                  description="A free pitch for a verified Community Interest Company."
                  icon={
                    <Building2 className="h-7 w-7" />
                  }
                  onClick={() =>
                    chooseApplication("cic")
                  }
                  wide
                />
              </div>

              <p className="mt-6 rounded-2xl bg-slate-100 p-4 text-sm font-medium leading-6 text-slate-600 dark:bg-white/[0.06] dark:text-white/60">
                All applications are reviewed by Burton Pride before
                a place is confirmed. Charity and C.I.C. applications
                must include registration evidence.
              </p>
            </div>
          </div>,
              document.body,
            )
          : null}
    </main>
  );
}

function ApplicationPickerCard({
  title,
  price,
  description,
  icon,
  onClick,
  wide = false,
}: {
  title: string;
  price: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-purple-300 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-500/15 dark:border-white/10 dark:bg-white/[0.05] dark:hover:border-purple-300/40 ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 p-3 text-purple-700 transition group-hover:scale-105 dark:from-pink-500/15 dark:to-purple-500/15 dark:text-purple-200">
          {icon}
        </div>

        <span className="rounded-full bg-purple-100 px-3 py-1.5 text-sm font-black text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
          {price}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-black">
        {title}
      </h3>

      <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-white/60">
        {description}
      </p>

      <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-purple-700 dark:text-purple-200">
        Choose this option
        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </button>
  );
}

function HeroInfo({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.05]">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
        <div>
          <p className="font-black">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-white/60">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

function PriceRow({
  label,
  price,
  last = false,
}: {
  label: string;
  price: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 bg-white px-4 py-3.5 dark:bg-white/[0.04] ${
        last
          ? ""
          : "border-b border-slate-200 dark:border-white/10"
      }`}
    >
      <span className="font-bold text-slate-700 dark:text-white/75">
        {label}
      </span>
      <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-black text-purple-700 dark:bg-purple-500/20 dark:text-purple-200">
        {price}
      </span>
    </div>
  );
}

function ApplicationCard({
  selected,
  title,
  description,
  price,
  icon,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  price: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`
        rounded-[1.75rem]
        border
        p-6
        text-left
        transition
        focus:outline-none
        focus:ring-2
        focus:ring-pink-300
        ${
          selected
            ? "border-pink-400 bg-white shadow-xl shadow-purple-900/15 dark:border-pink-300/50 dark:bg-pink-500/15 dark:shadow-pink-950/20"
            : "border-white/50 bg-white/90 shadow-lg shadow-purple-900/10 hover:-translate-y-1 hover:bg-white hover:shadow-xl dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.07]"
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`
            flex
            h-14
            w-14
            items-center
            justify-center
            rounded-2xl
            ${
              selected
                ? "bg-pink-100 text-pink-700 dark:bg-pink-400/20 dark:text-pink-200"
                : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/75"
            }
          `}
        >
          {icon}
        </div>

        {selected ? (
          <CheckCircle2 className="h-6 w-6 text-pink-600 dark:text-pink-200" />
        ) : null}
      </div>

      <h2 className="mt-5 text-xl font-black">
        {title}
      </h2>

      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600 dark:text-white/60">
        {description}
      </p>

      <p className="mt-4 text-xl font-black text-purple-700 dark:text-purple-200">
        {price}
      </p>
    </button>
  );
}

function ChoiceButton({
  selected,
  title,
  description,
  price,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  price: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`
        rounded-2xl
        border
        p-5
        text-left
        transition
        focus:outline-none
        focus:ring-2
        focus:ring-purple-300
        ${
          selected
            ? "border-purple-400 bg-purple-50 shadow-sm dark:border-purple-300/50 dark:bg-purple-500/15"
            : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-black/15 dark:hover:border-white/20"
        }
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-black">
            {title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-white/55">
            {description}
          </p>
        </div>

        <p className="shrink-0 font-black text-purple-700 dark:text-purple-200">
          {price}
        </p>
      </div>
    </button>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 text-purple-700 shadow-sm dark:from-pink-500/15 dark:to-purple-500/15 dark:text-purple-200">
        {icon}
      </div>

      <div>
        <h2 className="text-xl font-black sm:text-2xl">
          {title}
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-white/55">
          {description}
        </p>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  required = false,
  type = "text",
  placeholder,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block text-sm font-bold text-slate-800 dark:text-white/80">
      {label}

      {required ? (
        <span className="ml-1 text-pink-600 dark:text-pink-300">
          *
        </span>
      ) : null}

      <input
        className={inputClass}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        min={min}
        step={step}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
      />

      {error ? (
        <span className="mt-2 block text-xs font-medium text-red-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  error,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-bold text-slate-800 dark:text-white/80">
      {label}

      {required ? (
        <span className="ml-1 text-pink-600 dark:text-pink-300">
          *
        </span>
      ) : null}

      <textarea
        className={textareaClass}
        required={required}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
      />

      {error ? (
        <span className="mt-2 block text-xs font-medium text-red-300">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function CheckboxField({
  checked,
  label,
  onChange,
  required = false,
}: {
  checked: boolean;
  label: string;
  onChange: (
    checked: boolean,
  ) => void;
  required?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium leading-6 text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-white/10 dark:bg-black/15 dark:text-white/75 dark:hover:border-white/20">
      <input
        type="checkbox"
        checked={checked}
        required={required}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
        className="mt-1 h-4 w-4 shrink-0 accent-pink-500"
      />

      <span>{label}</span>
    </label>
  );
}

function DocumentUpload({
  label,
  uploaded,
  loading,
  onChange,
  required = false,
}: {
  label: string;
  uploaded: boolean;
  loading: boolean;
  onChange: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
  required?: boolean;
}) {
  return (
    <label className="block rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 transition hover:border-purple-400 hover:bg-purple-50 dark:border-white/20 dark:bg-black/15 dark:hover:border-purple-300/40 dark:hover:bg-purple-500/5">
      <span className="flex items-center gap-3 font-black text-slate-900 dark:text-white/85">
        <Upload className="h-5 w-5 text-purple-700 dark:text-purple-200" />

        {label}

        {required ? (
          <span className="text-pink-600 dark:text-pink-300">
            *
          </span>
        ) : null}
      </span>

      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        disabled={loading}
        onChange={onChange}
        className="
          mt-4
          block
          w-full
          cursor-pointer
          text-sm
          text-white/65
          file:mr-4
          file:rounded-xl
          file:border-0
          file:bg-purple-500/20
          file:px-4
          file:py-2
          file:font-bold
          file:text-purple-800 dark:text-purple-100
          hover:file:bg-purple-500/30
        "
      />

      <span className="mt-3 block text-xs leading-5 text-white/45">
        PDF, JPG, PNG or WEBP.
        Maximum file size 10MB.
      </span>

      {loading ? (
        <span className="mt-3 flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading document
        </span>
      ) : null}

      {uploaded ? (
        <span className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Document uploaded
          successfully
        </span>
      ) : null}
    </label>
  );
}