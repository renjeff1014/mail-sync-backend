import type { Request, Response } from 'express';
import { getSessionUser, setSessionUser, clearSession } from './session';
import type { SessionUser } from './session';
import { findUserById } from '../db/repositories/userRepository';

export async function getMe(req: Request, res: Response): Promise<void> {
  // requireAuth ensures req.isAuthenticated(); Passport sets req.user from session
  const sessionUser = (req as Request & { user?: SessionUser }).user ?? getSessionUser(req);
  if (!sessionUser) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = await findUserById(sessionUser.id);
  if (!user) {
    clearSession(req);
    res.status(401).json({ error: 'User not found' });
    return;
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      emailAccountId: sessionUser.emailAccountId,
    },
  });
}

export function logout(req: Request, res: Response): void {
  clearSession(req, () => {
    res.redirect(process.env.FRONTEND_URL || '/');
  });
}
