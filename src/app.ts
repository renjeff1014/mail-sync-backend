import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { configurePassport } from './auth/passport';
import { getGoogleAuthConfig } from './auth/config';
import { authRoutes, gmailRoutes, calendarRoutes } from './routes';

configurePassport();

// Log OAuth callback URL at startup so you can confirm it matches Google Cloud Console.
try {
  const { callbackURL } = getGoogleAuthConfig();
  console.log('OAuth callback URL (must match Google Console):', callbackURL);
} catch {
  // Config may throw if env vars missing
}

const app = express();

// CORS: allow frontend origin with credentials (cookies) for API calls
const frontendUrl = process.env.FRONTEND_URL;
if (frontendUrl) {
  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && (origin === frontendUrl || origin === frontendUrl.replace(/\/$/, ''))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

app.use(express.json());

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be set and at least 32 characters');
}
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth', authRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/calendar', calendarRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
