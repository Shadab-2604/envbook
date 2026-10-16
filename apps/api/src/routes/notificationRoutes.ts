import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  dismissNotification,
} from '../controllers/notificationController.js';

const router = Router();

router.get('/', requireAuth, getNotifications);
router.put('/read-all', requireAuth, markAllAsRead);
router.put('/:id/read', requireAuth, markAsRead);
router.delete('/:id', requireAuth, dismissNotification);

export default router;
