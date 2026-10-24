/** Shared draw data contracts. Validate untrusted API/database values at runtime.
 * These types do not authorize actions or enforce database transactions.
 */

/** One server-reported diagnostic check.
 * An individual `ok` value is not permission to execute a draw. Execution must
 * verify the complete eligibility, snapshot, locking, MFA and audit requirements.
 */
export type DrawReadinessCheck = {
  // Stable check identifier. Kept open for additional server-side safeguards.
  key: string;
  label: string;
  ok: boolean;
  detail?: string | null;
};

/** Admin draw workflow status, distinct from lottery lifecycle and public live
 * broadcast status. `ready` is a workflow label, not transaction authorization.
 * `completed` alone does not authorize publishing winner details.
 */
export type LotteryDrawStatus =
  | "upcoming"
  | "not_ready"
  | "ready"
  | "running"
  | "completed"
  | "blocked"
  | "under_review"
  | "redraw_requested"
  | "superseded";
