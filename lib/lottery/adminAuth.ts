import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export type LotteryAdmin = {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  permissions: string[];
};

const AUTH_TIMEOUT_MS = 10_000;

function authError(status: 401 | 403 | 503, message: string) {
  return Object.assign(new Error(message), { status });
}

/** Service-role client. This factory does not authenticate or authorize callers.
 * Admin routes must first call requireLotteryPermission (or an equivalent
 * verified guard). Public routes must enforce visibility/privacy themselves.
 * Never cache an authenticated LotteryAdmin across requests.
 */
function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw authError(503, "Administrator verification is unavailable.");
  }
  try {
    return createServiceClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } catch {
    throw authError(503, "Administrator verification is unavailable.");
  }
}

// The existing SSR client does not expose a per-call getUser AbortSignal.
// Bound the wait; this does not cancel the underlying authentication request.
function boundedRead<T>(operation: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(authError(503, "Administrator verification is unavailable."));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(operation).then(
      (value) => { signal.removeEventListener("abort", abort); resolve(value); },
      () => {
        signal.removeEventListener("abort", abort);
        reject(authError(503, "Administrator verification is unavailable."));
      },
    );
  });
}

/**
 * Resolve identity only from a server-verified Supabase user.
 * Binding matches the reviewed routes: admin_users.supabase_user_id = user.id.
 * No administrator-ID/email/session-marker cookie can select the account.
 * Requires the existing @/lib/supabase/server SSR client and a unique trusted
 * supabase_user_id mapping. Missing/duplicate mappings fail closed.
 *
 * This is an identity + permission guard, not proof of recent MFA, session
 * revocation, compliance approval, CSRF protection, or audited transactionality.
 * High-risk action routes must additionally enforce those relevant controls.
 */
export async function requireLotteryPermission(permission: string): Promise<LotteryAdmin> {
  if (typeof permission !== "string" || !/^lottery:[a-z][a-z0-9_-]*(?::[a-z][a-z0-9_-]*)*$/.test(permission)) {
    throw authError(403, "You do not have permission to perform this action.");
  }

  const signal = AbortSignal.timeout(AUTH_TIMEOUT_MS);
  let sessionClient: Awaited<ReturnType<typeof createSessionClient>>;
  try {
    sessionClient = await boundedRead(createSessionClient(), signal);
  } catch {
    throw authError(503, "Administrator verification is unavailable.");
  }

  // getUser contacts Supabase Auth; getSession/cookie identity is insufficient.
  let userResult;
  try {
    userResult = await boundedRead(sessionClient.auth.getUser(), signal);
  } catch {
    throw authError(503, "Administrator verification is unavailable.");
  }
  const { data: userData, error: userError } = userResult;
  if (userError || !userData?.user || typeof userData.user.id !== "string" || !userData.user.id) {
    throw authError(401, "Authentication required.");
  }
  const userId = userData.user.id;

  // Construct the privileged client only after verifying the caller's identity.
  let lookup;
  try {
    lookup = await adminDb()
      .from("admin_users")
      .select("id,supabase_user_id,email,name,role,permissions,is_active,is_main_admin")
      .eq("supabase_user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
  } catch {
    throw authError(503, "Administrator verification is unavailable.");
  }
  if (lookup.error) throw authError(503, "Administrator verification is unavailable.");
  const admin = lookup.data;
  if (
    !admin || admin.supabase_user_id !== userId || admin.is_active !== true ||
    typeof admin.id !== "string" || !admin.id
  ) throw authError(403, "An active administrator account is required.");

  const permissions: string[] = Array.isArray(admin.permissions)
    ? [...new Set(admin.permissions.filter((value: unknown): value is string =>
        typeof value === "string",
      ))] as string[]
    : [];
  const mainAdmin = admin.role === "main_admin" || admin.is_main_admin === true;
  if (!mainAdmin && !permissions.includes(permission)) {
    throw authError(403, "You do not have permission to perform this action.");
  }

  return {
    id: admin.id,
    email: typeof admin.email === "string" ? admin.email : null,
    name: typeof admin.name === "string" ? admin.name : null,
    role: typeof admin.role === "string" ? admin.role : null,
    permissions,
  };
}

export function lotteryAdminDb() {
  return adminDb();
}
