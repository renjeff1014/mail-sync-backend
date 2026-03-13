import { Router } from 'express';
import { requireAuth } from '../auth/requireAuth';
import { syncCalendar, listEvents } from './calendarController';

const router = Router();

router.use(requireAuth);

router.post('/sync', syncCalendar);
router.get('/events', listEvents);

export default router;
