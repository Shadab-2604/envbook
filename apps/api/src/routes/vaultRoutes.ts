import { Router } from 'express';
import { getVaultStatus, setupVault, rekeyVault } from '../controllers/vaultController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/status', requireAuth, getVaultStatus);
router.post('/setup', requireAuth, setupVault);
router.post('/rekey', requireAuth, rekeyVault);

export default router;
