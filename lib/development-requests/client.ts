"use client";
/** Includes the body read in the timeout, so an incomplete response cannot leave a spinner forever. */
export async function developmentJson(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const writing = options.method && options.method !== "GET";
  const timeout = window.setTimeout(() => controller.abort("timeout"), writing ? 45000 : 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (response.redirected || response.status === 401) throw new Error("Your admin session expired. Sign in again to open Development Requests.");
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The server returned an invalid response. Refresh or sign in again.");
    return { response, data };
  } catch (error) {
    if (controller.signal.reason === "timeout") throw new Error(writing ? "The save could not be confirmed in time. Refresh the requests before submitting again." : "Loading took too long. Check your connection and try again.");
    throw error;
  } finally { window.clearTimeout(timeout); options.signal?.removeEventListener("abort", abort); }
}
