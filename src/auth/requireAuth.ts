import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware: require authenticated user via Passport.
 * Use after passport.session() so req.isAuthenticated() and req.user are set from the session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (typeof (req as any).isAuthenticated !== 'function' || !(req as any).isAuthenticated()) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
