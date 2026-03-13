import { Router } from 'express';
import { requireAuth } from '../auth/requireAuth';
import { syncGmail, listEmails } from './gmailController';

const router = Router();

router.use(requireAuth);

router.post('/sync', syncGmail);
router.get('/emails', listEmails);

export default router;
