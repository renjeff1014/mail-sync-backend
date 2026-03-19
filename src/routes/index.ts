/**
 * Route modules are mounted in app.ts:
 * - authRoutes -> /api/auth
 * - gmailRoutes -> /api/gmail
 * - calendarRoutes -> /api/calendar
 * - jobsRoutes -> /api/jobs
 */
export { default as authRoutes } from '../auth/authRoutes';
export { default as gmailRoutes } from '../gmail/gmailRoutes';
export { default as calendarRoutes } from '../calendar/calendarRoutes';
export { default as jobsRoutes } from '../jobs/jobsRoutes';