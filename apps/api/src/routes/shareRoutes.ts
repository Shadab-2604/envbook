import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getShareSettings,
  updatePublicLink,
  revokePublicLink,
  publishPage,
  unpublishPage,
  searchUsers,
  addCollaborator,
  updateCollaborator,
  removeCollaborator,
  getPublicPublishedPage,
  getPublicSharedPage,
} from '../controllers/shareController.js';

const router = Router();

// Public link and published page endpoints (unauthenticated)
router.get('/public/p/:slug', getPublicPublishedPage);
router.get('/public/s/:token', getPublicSharedPage);

// Authenticated user search for sharing picker
router.get('/users/search', requireAuth, searchUsers);

// Page sharing & permissions (authenticated)
router.get('/pages/:pageId/share', requireAuth, getShareSettings);
router.put('/pages/:pageId/share/public-link', requireAuth, updatePublicLink);
router.delete('/pages/:pageId/share/public-link', requireAuth, revokePublicLink);
router.post('/pages/:pageId/publish', requireAuth, publishPage);
router.post('/pages/:pageId/unpublish', requireAuth, unpublishPage);

// Collaborators
router.post('/pages/:pageId/collaborators', requireAuth, addCollaborator);
router.put('/pages/:pageId/collaborators/:userId', requireAuth, updateCollaborator);
router.delete('/pages/:pageId/collaborators/:userId', requireAuth, removeCollaborator);

export default router;
