import "server-only";
import { optionalModeration, requireModerationOperation, ModerationAccessError } from "./access";
import { type NavigationViewer } from "./navigation";

export class NavigationError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

/** Resolve only from the validated server session, never identity cookies or request body. */
export async function getNavigationViewer(): Promise<NavigationViewer | null> {
  try {
    const actor = await optionalModeration();
    if (!actor) return null;
    return { displayName: actor.displayName, role: actor.role, isMainAdmin: actor.role === "main_admin", permissionKeys: actor.permissionKeys };
  } catch (error) {
    if (error instanceof ModerationAccessError) throw new NavigationError(error.message, error.status);
    throw error;
  }
}

export async function requireNavigationViewer(manage = false): Promise<NavigationViewer> {
  let viewer: NavigationViewer;
  try {
    const actor = await requireModerationOperation(manage ? "manageMenu" : "view");
    viewer = { displayName: actor.displayName, role: actor.role, isMainAdmin: actor.role === "main_admin", permissionKeys: actor.permissionKeys };
  } catch (error) {
    if (error instanceof ModerationAccessError) throw new NavigationError(error.message, error.status);
    throw error;
  }

  return viewer;
}
