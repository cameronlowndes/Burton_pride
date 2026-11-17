"use client";
export const NAVIGATION_CHANGED = "burton-moderation-navigation-changed";
export function notifyNavigationChanged() {
  window.dispatchEvent(new Event(NAVIGATION_CHANGED));
  try { localStorage.setItem(NAVIGATION_CHANGED, `${Date.now()}:${Math.random()}`); } catch { /* Storage can be unavailable. */ }
}
export function listenForNavigationChanges(reload: () => void): () => void {
  const onStorage = (event: StorageEvent) => { if (event.key === NAVIGATION_CHANGED) reload(); };
  window.addEventListener(NAVIGATION_CHANGED, reload);
  window.addEventListener("focus", reload);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(NAVIGATION_CHANGED, reload);
    window.removeEventListener("focus", reload);
    window.removeEventListener("storage", onStorage);
  };
}
