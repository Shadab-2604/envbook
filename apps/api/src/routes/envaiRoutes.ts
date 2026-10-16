import { Router } from 'express';
import {
  getEnvAiStatus,
  saveEnvAiConfig,
  testEnvAiConnection,
  deleteEnvAiConfig,
  generateEnvAiContent,
} from '../controllers/envaiController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/status', getEnvAiStatus);
router.put('/config', saveEnvAiConfig);
router.post('/test', testEnvAiConnection);
router.delete('/config', deleteEnvAiConfig);
router.post('/generate', generateEnvAiContent);

export default router;
