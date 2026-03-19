import { Router } from 'express';
import { requireAuth } from '../auth/requireAuth';
import { syncGmail, listEmails, getEmail } from './gmailController';

const router = Router();

router.use(requireAuth);

router.post('/sync', syncGmail);
router.get('/emails', listEmails);
router.get('/emails/:emailId', getEmail);

export default router;
