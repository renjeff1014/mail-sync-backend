import { Router } from 'express';
import { requireAuth } from '../auth/requireAuth';
import { listJobs, getApplication, getRelatedEmails } from './jobsController';

const router = Router();

router.get('/', listJobs);
router.get('/:jobId/application', requireAuth, getApplication);
router.get('/:jobId/related-emails', requireAuth, getRelatedEmails);

export default router;
