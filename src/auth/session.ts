import type { Request } from 'express';

export interface SessionUser {
  id: string;
  email: string;
  emailAccountId: string;
}

export interface AppSession {
  user?: SessionUser;
  passport?: { user: SessionUser };
}

/**
 * Get current user from session (Passport stores under passport.user).
 * Also checks req.user since Passport's session() middleware may set it from the session.
 */
export function getSessionUser(req: Request): SessionUser | undefined {
  const session = req.session as AppSession | undefined;
  const fromSession =
    session?.passport?.user ?? session?.user;
  if (fromSession) return fromSession;
  // Fallback: Passport sets req.user after deserializing from session
  const fromPassport = (req as Request & { user?: SessionUser }).user;
  return fromPassport;
}

export function setSessionUser(
  req: Request,
  user: SessionUser
): void {
  const s = req.session as AppSession;
  s.user = user;
  if (!s.passport) s.passport = { user };
  else s.passport.user = user;
}

/**
 * Destroy the session (express-session). Calls callback when done.
 */
export function clearSession(req: Request, callback?: (err?: unknown) => void): void {
  const s = req.session as { destroy?: (cb: (err?: unknown) => void) => void } | undefined;
  if (s?.destroy) {
    s.destroy(callback ?? (() => {}));
  } else {
    if (callback) process.nextTick(() => callback());
  }
}
