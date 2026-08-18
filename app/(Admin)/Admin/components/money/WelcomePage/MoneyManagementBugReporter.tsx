"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bug,
  Loader2,
  X,
} from "lucide-react";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";

type MoneyManagementBugReporterProps = {
  reporterName?: string;
  reporterEmail?: string;
};

type Priority =
  | "minor"
  | "normal"
  | "senior";

type FormState = {
  title: string;
  description: string;
  affectedFeature: string;
  stepsToReproduce: string;
  expectedResult: string;
  actualResult: string;
  priority: Priority;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  affectedFeature: "Money Management",
  stepsToReproduce: "",
  expectedResult: "",
  actualResult: "",
  priority: "normal",
};

export default function MoneyManagementBugReporter({
  reporterName = "",
  reporterEmail = "",
}: MoneyManagementBugReporterProps) {
  const [mounted, setMounted] =
    useState(false);

  const [open, setOpen] =
    useState(false);

  const [form, setForm] =
    useState<FormState>(
      EMPTY_FORM,
    );

  const [pageUrl, setPageUrl] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /*
   * React portals can only be created
   * once document.body exists.
   */
  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  /*
   * Store current Money Management URL.
   */
  useEffect(() => {
    if (
      typeof window !==
      "undefined"
    ) {
      setPageUrl(
        window.location.href,
      );
    }
  }, []);

  /*
   * Lock the page behind the modal
   * so only the popup scrolls.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow =
      document.body.style
        .overflow;

    const originalPaddingRight =
      document.body.style
        .paddingRight;

    const scrollbarWidth =
      window.innerWidth -
      document.documentElement
        .clientWidth;

    document.body.style.overflow =
      "hidden";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight =
        `${scrollbarWidth}px`;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key ===
          "Escape" &&
        !submitting
      ) {
        closeModal();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        originalOverflow;

      document.body.style.paddingRight =
        originalPaddingRight;

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open, submitting]);

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

    if (error) {
      setError("");
    }
  }

  function openModal() {
    setError("");
    setSuccess("");

    if (
      typeof window !==
      "undefined"
    ) {
      setPageUrl(
        window.location.href,
      );
    }

    setOpen(true);
  }

  function closeModal() {
    if (submitting) {
      return;
    }

    setOpen(false);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const title =
      form.title.trim();

    const description =
      form.description.trim();

    if (!title) {
      setError(
        "Please enter a bug title.",
      );

      return;
    }

    if (!description) {
      setError(
        "Please enter a description of the problem.",
      );

      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const response =
        await fetch(
          "/api/admin/bug-tracker",
          {
            method: "POST",

            /*
             * Send Burton Pride admin
             * authentication cookies.
             */
            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },

            body: JSON.stringify({
              /*
               * This makes the report
               * appear under Money
               * Management in the main
               * Admin Portal Bug Tracker.
               */
              application:
                "money_management",

              priority:
                form.priority,

              title,

              description,

              affected_feature:
                form.affectedFeature
                  .trim() ||
                "Money Management",

              page_url:
                pageUrl ||
                null,

              steps_to_reproduce:
                form.stepsToReproduce
                  .trim() ||
                null,

              expected_result:
                form.expectedResult
                  .trim() ||
                null,

              actual_result:
                form.actualResult
                  .trim() ||
                null,

              reporter_name:
                reporterName ||
                null,

              reporter_email:
                reporterEmail ||
                null,

              device:
                getDeviceType(),

              os:
                getOperatingSystem(),

              browser:
                getBrowserName(),

              environment:
                process.env
                  .NODE_ENV ===
                "production"
                  ? "production"
                  : "development",
            }),
          },
        );

      let data: any = null;

      try {
        data =
          await response.json();
      } catch {
        data = null;
      }

      if (
        response.status === 401
      ) {
        setError(
          "Your admin session has expired. Please sign in again.",
        );

        return;
      }

      if (
        response.status === 403
      ) {
        setError(
          "Your admin account does not have permission to submit bug reports.",
        );

        return;
      }

      if (!response.ok) {
        console.error(
          "Bug Tracker API error:",
          {
            status:
              response.status,
            statusText:
              response.statusText,
            data,
          },
        );

        setError(
          data?.error ||
            data?.message ||
            `The bug report could not be submitted. Error ${response.status}.`,
        );

        return;
      }

      const bugCode =
        data?.bug
          ?.bug_code ||
        data?.bug_code ||
        data?.code ||
        "";

      setSuccess(
        bugCode
          ? `Bug report ${bugCode} has been submitted to the Admin Portal Bug Tracker.`
          : "Your bug report has been submitted to the Admin Portal Bug Tracker.",
      );

      setForm({
        ...EMPTY_FORM,
      });
    } catch (submitError) {
      console.error(
        "Money Management bug report failed:",
        submitError,
      );

      setError(
        "Something went wrong while connecting to the Bug Tracker. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* ============================= */}
      {/* REPORT BUG BUTTON             */}
      {/* ============================= */}

      <button
        type="button"
        onClick={openModal}
        className="
          inline-flex
          min-h-11
          items-center
          justify-center
          gap-2
          rounded-2xl
          border
          border-red-400/20
          bg-red-500/10
          px-5
          py-3
          text-sm
          font-black
          text-red-100
          transition
          hover:border-red-400/30
          hover:bg-red-500/20
        "
      >
        <Bug className="h-4 w-4" />

        Report a bug
      </button>

      {/* ============================= */}
      {/* FULL SCREEN PORTAL            */}
      {/* ============================= */}

      {mounted &&
        open &&
        createPortal(
          <div
            className="
              fixed
              inset-0
              z-[2147483647]
              h-[100dvh]
              w-screen
              overflow-y-auto
              bg-[#05040b]/95
              backdrop-blur-md
            "
            role="dialog"
            aria-modal="true"
            aria-labelledby="money-management-bug-title"
          >
            {/* Full viewport wrapper */}
            <div
              className="
                flex
                min-h-[100dvh]
                w-full
                items-start
                justify-center
                px-3
                py-5
                sm:px-6
                sm:py-8
                lg:px-8
                lg:py-12
              "
              onMouseDown={(
                event,
              ) => {
                if (
                  event.target ===
                  event.currentTarget
                ) {
                  closeModal();
                }
              }}
            >
              {/* ========================= */}
              {/* MODAL CARD                */}
              {/* ========================= */}

              <div
                className="
                  relative
                  my-auto
                  w-full
                  max-w-[820px]
                  overflow-hidden
                  rounded-[30px]
                  border
                  border-white/10
                  bg-[#11111f]
                  shadow-[0_30px_120px_rgba(0,0,0,0.75)]
                "
              >
                {/* Pride gradient line */}
                <div
                  className="
                    h-[6px]
                    w-full
                    bg-gradient-to-r
                    from-red-500
                    via-pink-500
                    to-purple-500
                  "
                />

                <form
                  onSubmit={
                    handleSubmit
                  }
                  className="
                    px-5
                    pb-6
                    pt-6
                    sm:px-7
                    sm:pb-7
                    lg:px-8
                    lg:pb-8
                  "
                >
                  {/* ===================== */}
                  {/* HEADER                */}
                  {/* ===================== */}

                  <div
                    className="
                      flex
                      items-start
                      justify-between
                      gap-5
                    "
                  >
                    <div className="min-w-0 text-left">
                      <div
                        className="
                          flex
                          items-center
                          gap-2
                          text-[12px]
                          font-black
                          uppercase
                          tracking-[0.22em]
                          text-[#aaa5b3]
                        "
                      >
                        <Bug className="h-4 w-4" />

                        Burton Pride Bug
                        Tracker
                      </div>

                      <h2
                        id="money-management-bug-title"
                        className="
                          mt-2
                          text-2xl
                          font-black
                          tracking-tight
                          text-white
                          sm:text-[28px]
                        "
                      >
                        Report a bug
                      </h2>

                      <p
                        className="
                          mt-2
                          max-w-[650px]
                          text-sm
                          leading-6
                          text-[#aaa7b2]
                        "
                      >
                        This report is sent
                        directly to the Admin
                        Portal Bug Tracker.
                        Add enough detail for
                        the problem to be
                        reproduced and fixed.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        closeModal
                      }
                      disabled={
                        submitting
                      }
                      aria-label="Close bug report"
                      className="
                        inline-flex
                        h-11
                        shrink-0
                        items-center
                        justify-center
                        gap-2
                        rounded-full
                        bg-white/10
                        px-4
                        text-sm
                        font-medium
                        text-white/70
                        transition
                        hover:bg-white/15
                        hover:text-white
                        disabled:cursor-not-allowed
                        disabled:opacity-50
                      "
                    >
                      <span className="hidden sm:inline">
                        Close
                      </span>

                      <X className="h-4 w-4 sm:hidden" />
                    </button>
                  </div>

                  {/* ===================== */}
                  {/* APPLICATION/PRIORITY  */}
                  {/* ===================== */}

                  <div
                    className="
                      mt-8
                      grid
                      gap-5
                      md:grid-cols-2
                    "
                  >
                    <Field>
                      <Label>
                        Application
                      </Label>

                      <select
                        value="money_management"
                        disabled
                        className={
                          selectClass
                        }
                      >
                        <option value="money_management">
                          Money Management
                        </option>
                      </select>
                    </Field>

                    <Field>
                      <Label>
                        Priority
                      </Label>

                      <select
                        value={
                          form.priority
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "priority",
                            event
                              .target
                              .value as Priority,
                          )
                        }
                        disabled={
                          submitting
                        }
                        className={
                          selectClass
                        }
                      >
                        <option value="minor">
                          Minor
                        </option>

                        <option value="normal">
                          Normal
                        </option>

                        <option value="senior">
                          Senior
                        </option>
                      </select>
                    </Field>
                  </div>

                  {/* ===================== */}
                  {/* BUG TITLE             */}
                  {/* ===================== */}

                  <div className="mt-6">
                    <Field>
                      <Label>
                        Bug title *
                      </Label>

                      <input
                        type="text"
                        value={
                          form.title
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "title",
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          submitting
                        }
                        required
                        maxLength={
                          180
                        }
                        autoComplete="off"
                        placeholder="Example: Bank balance check does not update figures"
                        className={
                          inputClass
                        }
                      />
                    </Field>
                  </div>

                  {/* ===================== */}
                  {/* DESCRIPTION           */}
                  {/* ===================== */}

                  <div className="mt-6">
                    <Field>
                      <Label>
                        Description *
                      </Label>

                      <textarea
                        value={
                          form.description
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "description",
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          submitting
                        }
                        required
                        rows={5}
                        maxLength={
                          5000
                        }
                        placeholder="Explain what went wrong, where it happened and what you were trying to do."
                        className={
                          textareaClass
                        }
                      />
                    </Field>
                  </div>

                  {/* ===================== */}
                  {/* FEATURE + URL         */}
                  {/* ===================== */}

                  <div
                    className="
                      mt-6
                      grid
                      gap-5
                      md:grid-cols-2
                    "
                  >
                    <Field>
                      <Label>
                        Affected feature
                      </Label>

                      <input
                        type="text"
                        value={
                          form.affectedFeature
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "affectedFeature",
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          submitting
                        }
                        placeholder="Money Management"
                        className={
                          inputClass
                        }
                      />
                    </Field>

                    <Field>
                      <Label>
                        Page URL
                      </Label>

                      <input
                        type="text"
                        value={
                          pageUrl
                        }
                        readOnly
                        title={
                          pageUrl
                        }
                        className={`
                          ${inputClass}
                          cursor-default
                          text-white/70
                        `}
                      />
                    </Field>
                  </div>

                  {/* ===================== */}
                  {/* STEPS                 */}
                  {/* ===================== */}

                  <div className="mt-6">
                    <Field>
                      <Label>
                        Steps to reproduce
                      </Label>

                      <textarea
                        value={
                          form.stepsToReproduce
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "stepsToReproduce",
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          submitting
                        }
                        rows={5}
                        maxLength={
                          5000
                        }
                        placeholder={`1. Open Money Management
2. Go to the affected page
3. Press ...
4. The problem happens`}
                        className={
                          textareaClass
                        }
                      />
                    </Field>
                  </div>

                  {/* ===================== */}
                  {/* EXPECTED / ACTUAL     */}
                  {/* ===================== */}

                  <div
                    className="
                      mt-6
                      grid
                      gap-5
                      md:grid-cols-2
                    "
                  >
                    <Field>
                      <Label>
                        Expected result
                      </Label>

                      <textarea
                        value={
                          form.expectedResult
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "expectedResult",
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          submitting
                        }
                        rows={4}
                        maxLength={
                          3000
                        }
                        placeholder="What should have happened?"
                        className={
                          textareaClass
                        }
                      />
                    </Field>

                    <Field>
                      <Label>
                        Actual result
                      </Label>

                      <textarea
                        value={
                          form.actualResult
                        }
                        onChange={(
                          event,
                        ) =>
                          updateField(
                            "actualResult",
                            event
                              .target
                              .value,
                          )
                        }
                        disabled={
                          submitting
                        }
                        rows={4}
                        maxLength={
                          3000
                        }
                        placeholder="What actually happened?"
                        className={
                          textareaClass
                        }
                      />
                    </Field>
                  </div>

                  {/* ===================== */}
                  {/* AUTO INFO             */}
                  {/* ===================== */}

                  <div
                    className="
                      mt-6
                      rounded-2xl
                      border
                      border-white/10
                      bg-white/[0.035]
                      px-4
                      py-4
                      text-xs
                      leading-5
                      text-[#aaa7b2]
                      sm:px-5
                    "
                  >
                    Browser, operating system
                    and device type are added
                    automatically when the
                    report is submitted. The
                    signed-in administrator is
                    recorded by the Bug Tracker
                    API.
                  </div>

                  {/* ===================== */}
                  {/* ERROR                 */}
                  {/* ===================== */}

                  {error && (
                    <div
                      role="alert"
                      className="
                        mt-5
                        rounded-2xl
                        border
                        border-red-400/20
                        bg-red-500/10
                        px-4
                        py-4
                        text-sm
                        leading-6
                        text-red-100
                      "
                    >
                      {error}
                    </div>
                  )}

                  {/* ===================== */}
                  {/* SUCCESS               */}
                  {/* ===================== */}

                  {success && (
                    <div
                      role="status"
                      className="
                        mt-5
                        rounded-2xl
                        border
                        border-emerald-400/20
                        bg-emerald-500/10
                        px-4
                        py-4
                        text-sm
                        leading-6
                        text-emerald-100
                      "
                    >
                      {success}
                    </div>
                  )}

                  {/* ===================== */}
                  {/* FOOTER                */}
                  {/* ===================== */}

                  <div
                    className="
                      mt-7
                      flex
                      flex-col
                      gap-4
                      border-t
                      border-white/10
                      pt-6
                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                    "
                  >
                    <Link
                      href="/Admin/BugTracker"
                      className="
                        inline-flex
                        min-h-12
                        items-center
                        justify-center
                        gap-2
                        rounded-2xl
                        border
                        border-white/10
                        bg-white/[0.04]
                        px-5
                        text-sm
                        font-bold
                        text-white/70
                        transition
                        hover:bg-white/[0.08]
                        hover:text-white
                      "
                    >
                      Open full Bug Tracker

                      <ArrowRight className="h-4 w-4" />
                    </Link>

                    <div
                      className="
                        flex
                        flex-col
                        gap-3
                        sm:flex-row
                      "
                    >
                      <button
                        type="button"
                        onClick={
                          closeModal
                        }
                        disabled={
                          submitting
                        }
                        className="
                          min-h-12
                          rounded-2xl
                          bg-white/10
                          px-5
                          text-sm
                          font-medium
                          text-white/70
                          transition
                          hover:bg-white/15
                          hover:text-white
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                        "
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={
                          submitting ||
                          !!success
                        }
                        className="
                          inline-flex
                          min-h-12
                          items-center
                          justify-center
                          gap-2
                          rounded-2xl
                          bg-red-500
                          px-6
                          text-sm
                          font-black
                          text-white
                          transition
                          hover:bg-red-400
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                        "
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />

                            Submitting...
                          </>
                        ) : (
                          <>
                            <Bug className="h-4 w-4" />

                            Submit bug report
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ========================================================= */
/* SMALL FORM COMPONENTS                                     */
/* ========================================================= */

function Field({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      {children}
    </div>
  );
}

function Label({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <label
      className="
        mb-2
        block
        text-[12px]
        font-black
        uppercase
        tracking-[0.16em]
        text-[#8e8a98]
      "
    >
      {children}
    </label>
  );
}

/* ========================================================= */
/* FORM STYLES                                               */
/* ========================================================= */

const inputClass = `
  h-[52px]
  w-full
  min-w-0
  rounded-2xl
  border
  border-white/10
  bg-[#0b0b14]
  px-4
  text-sm
  text-white
  outline-none
  transition
  placeholder:text-[#666370]
  focus:border-pink-400/40
  focus:ring-2
  focus:ring-pink-500/10
  disabled:cursor-not-allowed
  disabled:opacity-60
`;

const selectClass = `
  h-[52px]
  w-full
  min-w-0
  rounded-2xl
  border
  border-white/10
  bg-[#0b0b14]
  px-4
  text-sm
  text-white
  outline-none
  transition
  focus:border-pink-400/40
  focus:ring-2
  focus:ring-pink-500/10
  disabled:cursor-not-allowed
  disabled:opacity-70
`;

const textareaClass = `
  w-full
  min-w-0
  resize-y
  rounded-2xl
  border
  border-white/10
  bg-[#0b0b14]
  px-4
  py-4
  text-sm
  leading-6
  text-white
  outline-none
  transition
  placeholder:text-[#666370]
  focus:border-pink-400/40
  focus:ring-2
  focus:ring-pink-500/10
  disabled:cursor-not-allowed
  disabled:opacity-60
`;

/* ========================================================= */
/* DEVICE INFORMATION                                        */
/* ========================================================= */

function getDeviceType() {
  if (
    typeof window ===
    "undefined"
  ) {
    return "Unknown";
  }

  const width =
    window.innerWidth;

  if (width < 768) {
    return "Mobile";
  }

  if (width < 1024) {
    return "Tablet";
  }

  return "Desktop/laptop";
}

function getBrowserName() {
  if (
    typeof navigator ===
    "undefined"
  ) {
    return "Unknown";
  }

  const userAgent =
    navigator.userAgent;

  if (
    userAgent.includes("Edg/")
  ) {
    return "Microsoft Edge";
  }

  if (
    userAgent.includes("OPR/")
  ) {
    return "Opera";
  }

  if (
    userAgent.includes(
      "Firefox/",
    )
  ) {
    return "Firefox";
  }

  if (
    userAgent.includes(
      "Chrome/",
    )
  ) {
    return "Google Chrome";
  }

  if (
    userAgent.includes(
      "Safari/",
    )
  ) {
    return "Safari";
  }

  return "Unknown";
}

function getOperatingSystem() {
  if (
    typeof navigator ===
    "undefined"
  ) {
    return "Unknown";
  }

  const userAgent =
    navigator.userAgent;

  if (
    userAgent.includes(
      "Windows",
    )
  ) {
    return "Windows";
  }

  if (
    userAgent.includes(
      "Android",
    )
  ) {
    return "Android";
  }

  if (
    /iPhone|iPad|iPod/.test(
      userAgent,
    )
  ) {
    return "iOS / iPadOS";
  }

  if (
    userAgent.includes(
      "Mac OS",
    )
  ) {
    return "macOS";
  }

  if (
    userAgent.includes(
      "Linux",
    )
  ) {
    return "Linux";
  }

  return "Unknown";
}