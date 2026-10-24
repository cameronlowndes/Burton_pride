"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  Sparkles,
  X,
} from "lucide-react";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";

type MoneyManagementFeatureRequestReporterProps = {
  reporterName?: string;
  reporterEmail?: string;
};

type Priority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

type FormState = {
  title: string;
  description: string;
  reasonNeeded: string;
  problemSolved: string;
  usersAffected: string;
  exampleWorkflow: string;
  priority: Priority;
};

type EmailDeliveryResult = {
  attempted: boolean;
  sent: boolean;
  recipient: string | null;
  email_id: string | null;
  error: string | null;
};

type SuccessState = {
  reference: string;
  message: string;
  internal: EmailDeliveryResult | null;
  requester: EmailDeliveryResult | null;
  allSent: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  reasonNeeded: "",
  problemSolved: "",
  usersAffected: "",
  exampleWorkflow: "",
  priority: "normal",
};

export default function MoneyManagementFeatureRequestReporter({
  reporterName = "",
  reporterEmail = "",
}: MoneyManagementFeatureRequestReporterProps) {
  const [mounted, setMounted] =
    useState(false);

  const [open, setOpen] =
    useState(false);

  const [form, setForm] =
    useState<FormState>({
      ...EMPTY_FORM,
    });

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState<SuccessState | null>(null);

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
   * Lock the page behind the popup
   * and close on Escape.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow =
      document.body.style.overflow;

    const originalPaddingRight =
      document.body.style.paddingRight;

    const scrollbarWidth =
      window.innerWidth -
      document.documentElement.clientWidth;

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
        event.key === "Escape" &&
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
    setSuccess(null);

    setOpen(true);
  }

  function closeModal() {
    if (submitting) {
      return;
    }

    setOpen(false);
    setError("");
    setSuccess(null);
    setForm({
      ...EMPTY_FORM,
    });
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
        "Please enter a feature title.",
      );

      return;
    }

    if (!description) {
      setError(
        "Please explain what feature you would like added or changed.",
      );

      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess(null);

      const response =
        await fetch(
          "/api/admin/developmentrequests",
          {
            method: "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },

            body: JSON.stringify({
              request_type:
                "feature",

              application:
                "Money Management",

              priority:
                form.priority,

              title,

              description,

              reason_needed:
                form.reasonNeeded
                  .trim() ||
                null,

              problem_solved:
                form.problemSolved
                  .trim() ||
                null,

              users_affected:
                form.usersAffected
                  .trim() ||
                null,

              example_workflow:
                form.exampleWorkflow
                  .trim() ||
                null,

              /*
               * These are only extra
               * display context.
               * The API should use the
               * signed-in admin as the
               * trusted requester.
               */
              reporter_name:
                reporterName ||
                null,

              reporter_email:
                reporterEmail ||
                null,

              app_name: "",
              required_pages: "",
              permissions_required: "",
              needs_sidebar: false,
              connects_to_other_apps: false,
              connected_apps: "",
              needs_public_pages: false,
              reporting_requirements: "",
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
          "Your admin account does not have permission to submit development requests.",
        );

        return;
      }

      if (!response.ok) {
        console.error(
          "Development Requests API error:",
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
            `The feature request could not be submitted. Error ${response.status}.`,
        );

        return;
      }

      const internal =
        data?.email_notifications
          ?.internal &&
        typeof data.email_notifications
          .internal === "object"
          ? (data.email_notifications
              .internal as EmailDeliveryResult)
          : null;

      const requester =
        data?.email_notifications
          ?.requester &&
        typeof data.email_notifications
          .requester === "object"
          ? (data.email_notifications
              .requester as EmailDeliveryResult)
          : null;

      setSuccess({
        reference:
          data?.request
            ?.reference_number ||
          "Saved",

        message:
          data?.message ||
          "Your feature request has been submitted to Development Requests.",

        internal,
        requester,

        allSent:
          data?.email_notifications
            ?.all_sent === true,
      });

      setForm({
        ...EMPTY_FORM,
      });
    } catch (submitError) {
      console.error(
        "Money Management feature request failed:",
        submitError,
      );

      setError(
        "Something went wrong while connecting to Development Requests. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* ============================= */}
      {/* REQUEST FEATURE BUTTON        */}
      {/* ============================= */}

      <button
        type="button"
        onClick={openModal}
        className="
          inline-flex
          min-h-11
          w-full
          items-center
          justify-center
          gap-2
          rounded-2xl
          border
          border-purple-400/20
          bg-purple-500/10
          px-5
          py-3
          text-sm
          font-black
          text-purple-100
          transition
          hover:border-purple-400/30
          hover:bg-purple-500/20
        "
      >
        <Sparkles className="h-4 w-4" />

        Request a new feature
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
            aria-labelledby="money-management-feature-title"
          >
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
                    from-purple-500
                    via-pink-500
                    to-emerald-500
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
                        <Sparkles className="h-4 w-4" />

                        Burton Pride
                        Development Requests
                      </div>

                      <h2
                        id="money-management-feature-title"
                        className="
                          mt-2
                          text-2xl
                          font-black
                          tracking-tight
                          text-white
                          sm:text-[28px]
                        "
                      >
                        Request a new feature
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
                        This request is sent
                        directly to the Admin
                        Portal Development Requests
                        system. Add enough detail
                        so the feature can be
                        reviewed and planned.
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
                      aria-label="Close feature request"
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

                  {!success && (
                    <>
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
                            value="Money Management"
                            disabled
                            className={
                              selectClass
                            }
                          >
                            <option value="Money Management">
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
                            <option value="low">
                              Low
                            </option>

                            <option value="normal">
                              Normal
                            </option>

                            <option value="high">
                              High
                            </option>

                            <option value="urgent">
                              Urgent
                            </option>
                          </select>
                        </Field>
                      </div>

                      {/* ===================== */}
                      {/* TITLE                 */}
                      {/* ===================== */}

                      <div className="mt-6">
                        <Field>
                          <Label>
                            Feature title *
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
                            maxLength={250}
                            autoComplete="off"
                            placeholder="Example: Add a monthly budget comparison report"
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
                            What would you like
                            added or changed? *
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
                            maxLength={20000}
                            placeholder="Explain the feature, where it should appear and what you would like it to do."
                            className={
                              textareaClass
                            }
                          />
                        </Field>
                      </div>

                      {/* ===================== */}
                      {/* WHY / PROBLEM         */}
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
                            Why is this needed?
                          </Label>

                          <textarea
                            value={
                              form.reasonNeeded
                            }
                            onChange={(
                              event,
                            ) =>
                              updateField(
                                "reasonNeeded",
                                event
                                  .target
                                  .value,
                              )
                            }
                            disabled={
                              submitting
                            }
                            rows={4}
                            maxLength={10000}
                            placeholder="How would this help Burton Pride or the admins using Money Management?"
                            className={
                              textareaClass
                            }
                          />
                        </Field>

                        <Field>
                          <Label>
                            What problem does it
                            solve?
                          </Label>

                          <textarea
                            value={
                              form.problemSolved
                            }
                            onChange={(
                              event,
                            ) =>
                              updateField(
                                "problemSolved",
                                event
                                  .target
                                  .value,
                              )
                            }
                            disabled={
                              submitting
                            }
                            rows={4}
                            maxLength={10000}
                            placeholder="Explain the current problem, limitation or extra work this would remove."
                            className={
                              textareaClass
                            }
                          />
                        </Field>
                      </div>

                      {/* ===================== */}
                      {/* USERS                 */}
                      {/* ===================== */}

                      <div className="mt-6">
                        <Field>
                          <Label>
                            Who will use it?
                          </Label>

                          <input
                            type="text"
                            value={
                              form.usersAffected
                            }
                            onChange={(
                              event,
                            ) =>
                              updateField(
                                "usersAffected",
                                event
                                  .target
                                  .value,
                              )
                            }
                            disabled={
                              submitting
                            }
                            maxLength={4000}
                            placeholder="Example: Main admins, finance admins or all Money Management users"
                            className={
                              inputClass
                            }
                          />
                        </Field>
                      </div>

                      {/* ===================== */}
                      {/* WORKFLOW              */}
                      {/* ===================== */}

                      <div className="mt-6">
                        <Field>
                          <Label>
                            Example of how it
                            should work
                          </Label>

                          <textarea
                            value={
                              form.exampleWorkflow
                            }
                            onChange={(
                              event,
                            ) =>
                              updateField(
                                "exampleWorkflow",
                                event
                                  .target
                                  .value,
                              )
                            }
                            disabled={
                              submitting
                            }
                            rows={5}
                            maxLength={12000}
                            placeholder={`1. Open Money Management
2. Go to the relevant page
3. Select the new option
4. The requested feature does ...`}
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
                        This request is
                        automatically recorded
                        under Money Management.
                        The signed-in
                        administrator is recorded
                        by the Development
                        Requests API.
                      </div>
                    </>
                  )}

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
                        mt-7
                        rounded-3xl
                        border
                        border-emerald-400/20
                        bg-emerald-500/10
                        p-5
                      "
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />

                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-black text-emerald-100">
                            Feature request
                            submitted
                          </h3>

                          <p className="mt-2 text-sm leading-6 text-emerald-100/70">
                            {
                              success.message
                            }
                          </p>

                          <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-black/15 p-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-100/45">
                              Request
                              reference
                            </p>

                            <p className="mt-1 text-xl font-black text-emerald-50">
                              {
                                success.reference
                              }
                            </p>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <EmailStatus
                              label="Cameron notification"
                              result={
                                success.internal
                              }
                              fallbackRecipient="cameronlowndes@burtonpride.co.uk"
                            />

                            <EmailStatus
                              label="Your confirmation"
                              result={
                                success.requester
                              }
                              fallbackRecipient={
                                reporterEmail
                              }
                            />
                          </div>

                          {!success.allSent && (
                            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100/80">
                              The feature request
                              has still been saved.
                              One or more emails
                              were not confirmed as
                              sent.
                            </div>
                          )}
                        </div>
                      </div>
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
                      href="/Admin/Dashboard/Settings/DevelopmentRequests"
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
                      Open Development Requests

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
                        {success
                          ? "Close"
                          : "Cancel"}
                      </button>

                      {!success && (
                        <button
                          type="submit"
                          disabled={
                            submitting
                          }
                          className="
                            inline-flex
                            min-h-12
                            items-center
                            justify-center
                            gap-2
                            rounded-2xl
                            bg-purple-500
                            px-6
                            text-sm
                            font-black
                            text-white
                            transition
                            hover:bg-purple-400
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
                              <Sparkles className="h-4 w-4" />

                              Submit feature
                              request
                            </>
                          )}
                        </button>
                      )}
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
/* EMAIL STATUS                                               */
/* ========================================================= */

function EmailStatus({
  label,
  result,
  fallbackRecipient,
}: {
  label: string;
  result: EmailDeliveryResult | null;
  fallbackRecipient?: string;
}) {
  const sent =
    result?.sent === true;

  const recipient =
    result?.recipient ||
    fallbackRecipient ||
    "Not recorded";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        sent
          ? "border-emerald-300/20 bg-emerald-500/[0.07]"
          : "border-amber-300/20 bg-amber-500/[0.07]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            sent
              ? "bg-emerald-500/15 text-emerald-200"
              : "bg-amber-500/15 text-amber-200"
          }`}
        >
          <Mail className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-black text-white/85">
            {label}
          </p>

          <p className="mt-1 break-all text-xs leading-5 text-white/45">
            {recipient}
          </p>

          <p
            className={`mt-2 text-xs font-black ${
              sent
                ? "text-emerald-200"
                : "text-amber-200"
            }`}
          >
            {sent
              ? "Email sent"
              : "Email not confirmed"}
          </p>

          {!sent &&
            result?.error && (
              <p className="mt-2 text-xs leading-5 text-amber-100/60">
                {result.error}
              </p>
            )}
        </div>
      </div>
    </div>
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
