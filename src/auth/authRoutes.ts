import { Router } from 'express';
import passport from 'passport';
import { SCOPES } from './config';
import { getMe, logout } from './authController';
import { requireAuth } from './requireAuth';

const router = Router();

const frontendBase = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '') || '/';

// Start Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: SCOPES })
);

// Google OAuth callback – Passport handles session and redirect.
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: true,
    failureRedirect: '/api/auth/failure',
    successRedirect: frontendBase + '/dashboard',
    failureMessage: true,
  })
);

// Current user (app-level passport.session() restores req.user; requireAuth checks req.isAuthenticated())
router.get('/me', getMe);

// Logout
router.post('/logout', logout);

export default router;
