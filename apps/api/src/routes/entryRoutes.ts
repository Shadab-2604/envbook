import { Router } from 'express';
import {
  getEntries,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
  restoreEntry,
  archiveEntry,
  duplicateEntry,
  moveEntries,
  getHistory,
  restoreHistoryVersion,
} from '../controllers/entryController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', getEntries);
router.post('/', createEntry);
router.post('/move', moveEntries);

router.get('/:id', getEntryById);
router.put('/:id', updateEntry);
router.delete('/:id', deleteEntry);

router.post('/:id/restore', restoreEntry);
router.post('/:id/archive', archiveEntry);
router.post('/:id/duplicate', duplicateEntry);

router.get('/:id/history', getHistory);
router.post('/:id/history/:versionId/restore', restoreHistoryVersion);

export default router;
