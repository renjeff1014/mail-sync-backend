import type { Request } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getGoogleAuthConfig, SCOPES } from './config';
import { upsertUserAndEmailAccount } from './authService';
import type { SessionUser } from './session';
import { findUserById } from '../db/repositories/userRepository';

/** Minimal payload stored in the session cookie (JSON-safe, no extra fields). */
export interface SerializedUser {
  id: string;
  emailAccountId: string;
}

export function configurePassport(): void {
  const { clientID, clientSecret, callbackURL } = getGoogleAuthConfig();

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        scope: SCOPES,
        passReqToCallback: true,
        accessType: 'offline',
        prompt: 'consent',
      } as any,
      async (
        _req: Request,
        accessToken: string,
        refreshToken: string | undefined,
        profile: passport.Profile,
        done: (err: Error | null, user?: SessionUser) => void
      ) => {
        try {
          const email =
            profile.emails?.[0]?.value ||
            (profile as { _json?: { email?: string } })._json?.email;
          if (!email) {
            return done(new Error('No email in Google profile'));
          }
          const expiryDate = new Date(Date.now() + 60 * 60 * 1000);
          const { user, emailAccountId } = await upsertUserAndEmailAccount({
            email,
            access_token: accessToken,
            refresh_token: refreshToken ?? null,
            expiry_date: expiryDate,
          });
          const sessionUser: SessionUser = {
            id: user.id,
            email: user.email,
            emailAccountId,
          };
          return done(null, sessionUser);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  // Store only id + emailAccountId so the session cookie is small and JSON-safe.
  passport.serializeUser((user: SessionUser, done) => {
    done(null, {
      id: String(user.id),
      emailAccountId: String(user.emailAccountId),
    } as SerializedUser);
  });

  // Restore full SessionUser from DB so data is fresh and correctly typed.
  passport.deserializeUser((payload: unknown, done) => {
    const p = payload as SerializedUser | null | undefined;
    if (!p || typeof p !== 'object' || !p.id) {
      return done(null, false);
    }
    findUserById(String(p.id))
      .then((user) => {
        if (!user) return done(null, false);
        const emailAccountId = p.emailAccountId != null ? String(p.emailAccountId) : user.id;
        done(null, {
          id: user.id,
          email: user.email,
          emailAccountId,
        } as SessionUser);
      })
      .catch((err) => done(err));
  });
}
