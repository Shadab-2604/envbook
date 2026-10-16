import { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Entry } from '../models/Entry.js';
import { PageShare } from '../models/PageShare.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import {
  SharePublicLinkSchema,
  PublishPageSchema,
  AddCollaboratorSchema,
  UpdateCollaboratorSchema,
} from '@envbook/shared';
import {
  broadcastNotification,
  broadcastPermissionChange,
} from '../socket.js';

function formatShare(share: any, currentUserId?: string) {
  const isOwner = currentUserId && share.ownerId.toString() === currentUserId;
  let currentUserRole: 'owner' | 'editor' | 'viewer' = isOwner ? 'owner' : 'viewer';

  if (!isOwner && currentUserId) {
    const collab = share.collaborators.find(
      (c: any) => c.userId.toString() === currentUserId
    );
    if (collab) currentUserRole = collab.role;
  }

  return {
    pageId: share.pageId,
    ownerId: share.ownerId.toString(),
    isOwner,
    currentUserRole,
    isPublicLinkEnabled: Boolean(share.isPublicLinkEnabled),
    publicShareToken: share.isPublicLinkEnabled ? share.publicShareToken : null,
    publicAccessLevel: share.publicAccessLevel || 'viewer',
    publicUrl:
      share.isPublicLinkEnabled && share.publicShareToken
        ? `/s/${share.publicShareToken}`
        : undefined,
    isPublished: Boolean(share.isPublished),
    publishedSlug: share.isPublished ? share.publishedSlug : null,
    publishedUrl:
      share.isPublished && share.publishedSlug ? `/p/${share.publishedSlug}` : undefined,
    publishedTitle: share.publishedTitle || '',
    publishedContent: share.publishedContent || '',
    publishedAt: share.publishedAt ? share.publishedAt.toISOString() : null,
    collaborators: (share.collaborators || []).map((c: any) => ({
      userId: c.userId.toString(),
      username: c.username,
      email: c.email,
      name: c.name,
      role: c.role,
      invitedAt: c.invitedAt.toISOString(),
    })),
    createdAt: share.createdAt ? share.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: share.updatedAt ? share.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export async function getShareSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const { pageId } = req.params;

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry) {
      res.status(404).json({ error: 'Page not found', code: 'NOT_FOUND' });
      return;
    }

    let share = await PageShare.findOne({ pageId });
    if (!share) {
      if (entry.owner.toString() !== currentUserId) {
        res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
        return;
      }

      share = await PageShare.create({
        pageId,
        ownerId: entry.owner,
        isPublicLinkEnabled: false,
        isPublished: false,
        collaborators: [],
      });
    }

    const isOwner = share.ownerId.toString() === currentUserId;
    const isCollab = share.collaborators.some(
      (c: any) => c.userId.toString() === currentUserId
    );

    if (!isOwner && !isCollab) {
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
      return;
    }

    res.json({ share: formatShare(share, currentUserId) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function updatePublicLink(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const { pageId } = req.params;
    const parsed = SharePublicLinkSchema.parse(req.body);

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== currentUserId) {
      res.status(403).json({ error: 'Only the page owner can configure public sharing', code: 'FORBIDDEN' });
      return;
    }

    let share = await PageShare.findOne({ pageId });
    if (!share) {
      share = new PageShare({
        pageId,
        ownerId: entry.owner,
        collaborators: [],
      });
    }

    share.isPublicLinkEnabled = parsed.isEnabled;
    if (parsed.accessLevel) {
      share.publicAccessLevel = parsed.accessLevel;
    }

    if (parsed.isEnabled && !share.publicShareToken) {
      share.publicShareToken = crypto.randomBytes(24).toString('hex');
    }

    await share.save();
    res.json({ share: formatShare(share, currentUserId) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update public link' });
  }
}

export async function revokePublicLink(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const { pageId } = req.params;

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== currentUserId) {
      res.status(403).json({ error: 'Only the page owner can revoke public links', code: 'FORBIDDEN' });
      return;
    }

    const share = await PageShare.findOne({ pageId });
    if (share) {
      share.isPublicLinkEnabled = false;
      share.publicShareToken = null;
      await share.save();
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function publishPage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const { pageId } = req.params;
    const parsed = PublishPageSchema.parse(req.body);

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== currentUserId) {
      res.status(403).json({ error: 'Only the page owner can publish pages', code: 'FORBIDDEN' });
      return;
    }

    if (entry.type === 'environment_page' || entry.type === 'credential' || entry.type.includes('env')) {
      res.status(400).json({
        error: 'Secret-bearing environment pages and credentials cannot be published publicly.',
        code: 'SECRET_PUBLICATION_BLOCKED',
      });
      return;
    }

    let baseSlug = (parsed.slug || parsed.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = 'page-' + pageId.slice(0, 8);

    let finalSlug = baseSlug;
    let collisionCount = 0;
    while (true) {
      const existing = await PageShare.findOne({
        publishedSlug: finalSlug,
        pageId: { $ne: pageId },
      });
      if (!existing) break;
      collisionCount++;
      finalSlug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
      if (collisionCount > 5) {
        finalSlug = `${baseSlug}-${Date.now().toString(36)}`;
        break;
      }
    }

    let share = await PageShare.findOne({ pageId });
    if (!share) {
      share = new PageShare({
        pageId,
        ownerId: entry.owner,
        collaborators: [],
      });
    }

    share.isPublished = true;
    share.publishedSlug = finalSlug;
    share.publishedTitle = parsed.title;
    share.publishedContent = parsed.content;
    share.publishedAt = new Date();
    await share.save();

    for (const collab of share.collaborators) {
      const notif = await Notification.create({
        recipientId: collab.userId,
        actorId: req.user!._id,
        actorName: req.user!.username,
        type: 'page_published',
        pageId,
        pageTitle: parsed.title,
        message: `${req.user!.username} published "${parsed.title}" to the web.`,
        isRead: false,
      });
      broadcastNotification(collab.userId.toString(), notif);
    }

    res.json({
      success: true,
      share: formatShare(share, currentUserId),
      publishedUrl: `/p/${finalSlug}`,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to publish page' });
  }
}

export async function unpublishPage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const { pageId } = req.params;

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== currentUserId) {
      res.status(403).json({ error: 'Only the page owner can unpublish pages', code: 'FORBIDDEN' });
      return;
    }

    const share = await PageShare.findOne({ pageId });
    if (share) {
      share.isPublished = false;
      share.publishedSlug = null;
      await share.save();

      for (const collab of share.collaborators) {
        const notif = await Notification.create({
          recipientId: collab.userId,
          actorId: req.user!._id,
          actorName: req.user!.username,
          type: 'page_unpublished',
          pageId,
          pageTitle: share.publishedTitle || 'Untitled',
          message: `${req.user!.username} unpublished "${share.publishedTitle || 'Untitled'}".`,
          isRead: false,
        });
        broadcastNotification(collab.userId.toString(), notif);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function searchUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const query = String(req.query.q || '').trim();
    if (!query || query.length < 2) {
      res.json({ users: [] });
      return;
    }

    const currentUserId = req.user!._id.toString();
    const regex = new RegExp(query, 'i');

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [{ username: regex }, { email: regex }, { name: regex }],
    })
      .select('_id username email name')
      .limit(8);

    res.json({
      users: users.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        email: u.email,
        name: u.name,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function addCollaborator(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const { pageId } = req.params;
    const parsed = AddCollaboratorSchema.parse(req.body);

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== currentUserId) {
      res.status(403).json({ error: 'Only the page owner can add collaborators', code: 'FORBIDDEN' });
      return;
    }

    const targetUser = await User.findOne({
      $or: [
        { username: parsed.usernameOrEmail.toLowerCase() },
        { email: parsed.usernameOrEmail.toLowerCase() },
      ],
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found in EnvBook registry', code: 'USER_NOT_FOUND' });
      return;
    }

    if (targetUser._id.toString() === currentUserId) {
      res.status(400).json({ error: 'You are already the owner of this page', code: 'CANNOT_ADD_SELF' });
      return;
    }

    let share = await PageShare.findOne({ pageId });
    if (!share) {
      share = new PageShare({
        pageId,
        ownerId: entry.owner,
        collaborators: [],
      });
    }

    if (share.collaborators.some((c: any) => c.userId.toString() === targetUser._id.toString())) {
      res.status(400).json({ error: 'This user is already a collaborator on this page', code: 'ALREADY_COLLABORATOR' });
      return;
    }

    share.collaborators.push({
      userId: targetUser._id,
      username: targetUser.username,
      email: targetUser.email,
      name: targetUser.name,
      role: parsed.role,
      invitedAt: new Date(),
    });

    await share.save();

    const notif = await Notification.create({
      recipientId: targetUser._id,
      actorId: req.user!._id,
      actorName: req.user!.username,
      type: 'share_invite',
      pageId,
      pageTitle: share.publishedTitle || 'Untitled Note',
      message: `${req.user!.username} shared "${share.publishedTitle || 'a note'}" with you as ${parsed.role}.`,
      isRead: false,
    });
    broadcastNotification(targetUser._id.toString(), notif);
    broadcastPermissionChange(targetUser._id.toString(), pageId, parsed.role);

    res.json({ share: formatShare(share, currentUserId) });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to add collaborator' });
  }
}

export async function updateCollaborator(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const { pageId, userId } = req.params;
    const parsed = UpdateCollaboratorSchema.parse(req.body);

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== currentUserId) {
      res.status(403).json({ error: 'Only the page owner can update permissions', code: 'FORBIDDEN' });
      return;
    }

    const share = await PageShare.findOne({ pageId });
    if (!share) {
      res.status(404).json({ error: 'Share record not found' });
      return;
    }

    const collab = share.collaborators.find((c: any) => c.userId.toString() === userId);
    if (!collab) {
      res.status(404).json({ error: 'Collaborator not found on this page' });
      return;
    }

    collab.role = parsed.role;
    await share.save();

    const notif = await Notification.create({
      recipientId: collab.userId,
      actorId: req.user!._id,
      actorName: req.user!.username,
      type: 'permission_change',
      pageId,
      pageTitle: share.publishedTitle || 'Untitled Note',
      message: `Your permission for "${share.publishedTitle || 'Untitled Note'}" was updated to ${parsed.role}.`,
      isRead: false,
    });
    broadcastNotification(collab.userId.toString(), notif);
    broadcastPermissionChange(collab.userId.toString(), pageId, parsed.role);

    res.json({ share: formatShare(share, currentUserId) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}

export async function removeCollaborator(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const { pageId, userId } = req.params;

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== currentUserId) {
      res.status(403).json({ error: 'Only the page owner can remove collaborators', code: 'FORBIDDEN' });
      return;
    }

    const share = await PageShare.findOne({ pageId });
    if (!share) {
      res.status(404).json({ error: 'Share record not found' });
      return;
    }

    share.collaborators = share.collaborators.filter((c: any) => c.userId.toString() !== userId);
    await share.save();

    const notif = await Notification.create({
      recipientId: userId,
      actorId: req.user!._id,
      actorName: req.user!.username,
      type: 'access_revoked',
      pageId,
      pageTitle: share.publishedTitle || 'Untitled Note',
      message: `Your access to "${share.publishedTitle || 'Untitled Note'}" was revoked.`,
      isRead: false,
    });
    broadcastNotification(userId, notif);
    broadcastPermissionChange(userId, pageId, null);

    res.json({ share: formatShare(share, currentUserId) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPublicPublishedPage(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const share = await PageShare.findOne({
      publishedSlug: slug.toLowerCase(),
      isPublished: true,
    }).populate('ownerId', 'name username');

    if (!share) {
      res.status(404).json({ error: 'Published page not found or unpublished', code: 'NOT_FOUND' });
      return;
    }

    const owner: any = share.ownerId;
    res.json({
      title: share.publishedTitle,
      content: share.publishedContent,
      publishedAt: share.publishedAt ? share.publishedAt.toISOString() : null,
      author: owner ? { name: owner.name, username: owner.username } : { name: 'Author', username: 'author' },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getPublicSharedPage(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.params;
    const share = await PageShare.findOne({
      publicShareToken: token,
      isPublicLinkEnabled: true,
    }).populate('ownerId', 'name username');

    if (!share) {
      res.status(404).json({ error: 'Share link invalid or revoked', code: 'NOT_FOUND' });
      return;
    }

    const owner: any = share.ownerId;
    res.json({
      pageId: share.pageId,
      title: share.publishedTitle || 'Shared Note',
      content: share.publishedContent,
      accessLevel: share.publicAccessLevel || 'viewer',
      author: owner ? { name: owner.name, username: owner.username } : { name: 'Author', username: 'author' },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
