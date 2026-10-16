import { Router } from 'express';
import { exportBackup, restoreBackup } from '../controllers/backupController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/export', exportBackup);
router.post('/restore', restoreBackup);

export default router;
