import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/server/db';
import { User, IUser } from '@/server/models/User';
import { Entry, IEntry } from '@/server/models/Entry';
import { logSecurityEvent } from '@/server/models/AuditLog';
import { hashPassword, verifyPassword } from '@/server/password';
import { signToken, verifyToken } from '@/server/jwt';
import {
  SignupSchema,
  LoginSchema,
  ChangePasswordSchema,
  VaultSetupSchema,
  CreateEntrySchema,
  UpdateEntrySchema,
  SafeUser,
  EnvAiConfigSchema,
  EnvAiGenerateSchema,
  SharePublicLinkSchema,
  PublishPageSchema,
  AddCollaboratorSchema,
  UpdateCollaboratorSchema,
} from '@envbook/shared';
import { AiProviderSettings } from '@/server/models/AiProviderSettings';
import { PageShare } from '@/server/models/PageShare';
import { Notification } from '@/server/models/Notification';
import { encryptProviderKey, decryptProviderKey } from '@/server/keyCrypto';
import { testGeminiApiKey, callGeminiApi, DEFAULT_GEMINI_MODEL } from '@/server/geminiService';
import { isResourceAllowed } from '@/server/securityFilter';
import { randomUUID, randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

function formatShareRecord(share: any, currentUserId?: string) {
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

function formatUser(user: any): SafeUser {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    email: user.email,
    vaultInitialized: Boolean(user.vaultMetadata?.isInitialized),
    createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

function formatEntry(entry: any) {
  return {
    id: entry._id.toString(),
    entryId: entry.entryId,
    parentId: entry.parentId,
    type: entry.type,
    sortOrder: entry.sortOrder,
    encryptedPayload: entry.encryptedPayload,
    nonce: entry.nonce,
    aad: entry.aad || '',
    cryptoVersion: entry.cryptoVersion || '1.0',
    isFavorite: Boolean(entry.isFavorite),
    isArchived: Boolean(entry.isArchived),
    isDeleted: Boolean(entry.isDeleted),
    deletedAt: entry.deletedAt ? entry.deletedAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    versionCount: entry.history ? entry.history.length : 0,
  };
}

async function getAuthUser(req: NextRequest): Promise<IUser | null> {
  const token = req.cookies.get('envbook_token')?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || !payload.userId) return null;

  await connectDB();
  return User.findById(payload.userId);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join('/');

  await connectDB();

  // Health
  if (pathStr === 'v1/health' || pathStr === 'health') {
    return NextResponse.json({
      status: 'ok',
      service: 'envbook-integrated-api',
      timestamp: new Date().toISOString(),
    });
  }

  // Auth / Me
  if (pathStr === 'v1/auth/me') {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    return NextResponse.json({ user: formatUser(user) });
  }

  // Vault Status
  if (pathStr === 'v1/vault/status') {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const meta = user.vaultMetadata;
    return NextResponse.json({
      isInitialized: Boolean(meta?.isInitialized),
      salt: meta?.salt,
      kdfParams: meta?.kdfParams,
      keyVersion: meta?.keyVersion,
      wrappedDEK: meta?.wrappedDEK,
      nonce: meta?.nonce,
      recoverySalt: meta?.recoverySalt,
      recoveryWrappedDEK: meta?.recoveryWrappedDEK,
      recoveryNonce: meta?.recoveryNonce,
    });
  }

  // envAi Status: /v1/envai/status
  if (pathStr === 'v1/envai/status') {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const settings = await AiProviderSettings.findOne({ userId: user._id });
    if (!settings) {
      return NextResponse.json({
        isConfigured: false,
        model: DEFAULT_GEMINI_MODEL,
        lastTestStatus: 'untested',
      });
    }

    return NextResponse.json({
      isConfigured: true,
      model: settings.model || DEFAULT_GEMINI_MODEL,
      lastTestedAt: settings.lastTestedAt?.toISOString(),
      lastTestStatus: settings.lastTestStatus || 'untested',
      message: settings.lastTestMessage,
    });
  }

  // Entries List: /v1/entries
  if (pathStr === 'v1/entries') {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const parentId = url.searchParams.get('parentId');
    const isFavorite = url.searchParams.get('isFavorite');
    const isArchived = url.searchParams.get('isArchived');
    const isDeleted = url.searchParams.get('isDeleted');

    const filter: Record<string, any> = { owner: user._id };
    if (type) filter.type = type;
    if (parentId !== null && parentId !== undefined) {
      filter.parentId = parentId === 'null' || parentId === '' ? null : parentId;
    }
    if (isFavorite !== null && isFavorite !== undefined) {
      filter.isFavorite = isFavorite === 'true';
    }
    if (isArchived !== null && isArchived !== undefined) {
      filter.isArchived = isArchived === 'true';
    }
    if (isDeleted !== null && isDeleted !== undefined) {
      filter.isDeleted = isDeleted === 'true';
    } else {
      filter.isDeleted = false;
    }

    const entries = await Entry.find(filter).sort({ sortOrder: 1, updatedAt: -1 }).limit(500);
    return NextResponse.json({
      entries: entries.map(formatEntry),
      total: entries.length,
    });
  }

  // Single Entry: /v1/entries/:id
  if (path.length === 3 && path[0] === 'v1' && path[1] === 'entries') {
    const id = path[2];
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const entry = await Entry.findOne({ owner: user._id, entryId: id });
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found', code: 'ENTRY_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ entry: formatEntry(entry) });
  }

  // Entry History: /v1/entries/:id/history
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'entries' && path[3] === 'history') {
    const id = path[2];
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const entry = await Entry.findOne({ owner: user._id, entryId: id });
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found', code: 'ENTRY_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      history: (entry.history || []).map((h) => ({
        id: h._id?.toString() || '',
        versionId: h._id?.toString() || '',
        encryptedPayload: h.encryptedPayload,
        nonce: h.nonce,
        schemaVersion: 1,
        createdAt: h.updatedAt.toISOString(),
        updatedAt: h.updatedAt.toISOString(),
      })),
    });
  }

  // Backup Export: /v1/backup/export
  if (pathStr === 'v1/backup/export') {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const entries = await Entry.find({ owner: user._id });
    return NextResponse.json({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      vaultMetadata: user.vaultMetadata,
      entries: entries.map(formatEntry),
    });
  }

  // Share Settings: /v1/pages/:pageId/share
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'pages' && path[3] === 'share') {
    const pageId = path[2];
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    let share = await PageShare.findOne({ pageId });
    if (!share) {
      if (entry.owner.toString() !== user._id.toString()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      share = await PageShare.create({
        pageId,
        ownerId: entry.owner,
        isPublicLinkEnabled: false,
        isPublished: false,
        collaborators: [],
      });
    }

    const isOwner = share.ownerId.toString() === user._id.toString();
    const isCollab = share.collaborators.some(
      (c: any) => c.userId.toString() === user._id.toString()
    );

    if (!isOwner && !isCollab) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ share: formatShareRecord(share, user._id.toString()) });
  }

  // Public Published Page: /v1/public/p/:slug
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'public' && path[2] === 'p') {
    const slug = path[3].toLowerCase();
    const share = await PageShare.findOne({
      publishedSlug: slug,
      isPublished: true,
    }).populate('ownerId', 'name username');

    if (!share) {
      return NextResponse.json({ error: 'Published page not found or unpublished' }, { status: 404 });
    }

    const owner: any = share.ownerId;
    return NextResponse.json({
      title: share.publishedTitle,
      content: share.publishedContent,
      publishedAt: share.publishedAt ? share.publishedAt.toISOString() : null,
      author: owner ? { name: owner.name, username: owner.username } : { name: 'Author', username: 'author' },
    });
  }

  // Public Share Token Page: /v1/public/s/:token
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'public' && path[2] === 's') {
    const token = path[3];
    const share = await PageShare.findOne({
      publicShareToken: token,
      isPublicLinkEnabled: true,
    }).populate('ownerId', 'name username');

    if (!share) {
      return NextResponse.json({ error: 'Shared page not found or link revoked' }, { status: 404 });
    }

    const owner: any = share.ownerId;
    return NextResponse.json({
      pageId: share.pageId,
      title: share.publishedTitle || 'Shared Note',
      content: share.publishedContent,
      accessLevel: share.publicAccessLevel || 'viewer',
      author: owner ? { name: owner.name, username: owner.username } : { name: 'Author', username: 'author' },
    });
  }

  // User Search: /v1/users/search?q=...
  if (pathStr === 'v1/users/search') {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const regex = new RegExp(q, 'i');
    const users = await User.find({
      _id: { $ne: user._id },
      $or: [{ username: regex }, { email: regex }, { name: regex }],
    })
      .select('_id username email name')
      .limit(8);

    return NextResponse.json({
      users: users.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        email: u.email,
        name: u.name,
      })),
    });
  }

  // In-App Notifications: /v1/notifications
  if (pathStr === 'v1/notifications') {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const notifications = await Notification.find({ recipientId: user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipientId: user._id,
      isRead: false,
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        recipientId: n.recipientId.toString(),
        actorId: n.actorId.toString(),
        actorName: n.actorName,
        type: n.type,
        pageId: n.pageId,
        pageTitle: n.pageTitle,
        message: n.message,
        isRead: Boolean(n.isRead),
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  }

  return NextResponse.json({ error: 'Endpoint not found', path: pathStr }, { status: 404 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join('/');

  await connectDB();

  // 1. Auth Signup
  if (pathStr === 'v1/auth/signup') {
    try {
      const body = await req.json();
      const input = SignupSchema.parse(body);

      const existing = await User.findOne({
        $or: [{ username: input.username }, { email: input.email }],
      });
      if (existing) {
        const field = existing.username === input.username ? 'Username' : 'Email';
        return NextResponse.json(
          { error: `${field} is already taken. Please choose another.`, code: 'USER_EXISTS' },
          { status: 409 }
        );
      }

      const passwordHash = await hashPassword(input.password);
      const user = await User.create({
        name: input.name,
        username: input.username,
        email: input.email,
        passwordHash,
        vaultMetadata: { isInitialized: false },
      });

      const token = signToken({ userId: user._id.toString(), username: user.username });
      const res = NextResponse.json({
        user: formatUser(user),
        message: 'Account created successfully',
      });

      res.cookies.set('envbook_token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return res;
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Signup failed', code: 'VALIDATION_ERROR' }, { status: 400 });
    }
  }

  // 2. Auth Login
  if (pathStr === 'v1/auth/login') {
    try {
      const body = await req.json();
      const input = LoginSchema.parse(body);

      const identifier = input.identifier.trim();
      const user = await User.findOne({
        $or: [
          { username: identifier.toLowerCase() },
          { email: identifier.toLowerCase() },
          { username: identifier },
          { email: identifier }
        ],
      });
      if (!user) {
        return NextResponse.json({ error: 'Invalid identifier or password.', code: 'INVALID_CREDENTIALS' }, { status: 401 });
      }

      const isValid = await verifyPassword(user.passwordHash, input.password);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid identifier or password.', code: 'INVALID_CREDENTIALS' }, { status: 401 });
      }

      const token = signToken({ userId: user._id.toString(), username: user.username });
      const res = NextResponse.json({
        user: formatUser(user),
        message: 'Login successful',
      });

      res.cookies.set('envbook_token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });

      return res;
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Login failed', code: 'VALIDATION_ERROR' }, { status: 400 });
    }
  }

  // 3. Auth Logout
  if (pathStr === 'v1/auth/logout') {
    const res = NextResponse.json({ message: 'Logged out successfully' });
    res.cookies.set('envbook_token', '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  }

  // 4. Auth Change Password
  if (pathStr === 'v1/auth/change-password') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const body = await req.json();
      const input = ChangePasswordSchema.parse(body);

      const valid = await verifyPassword(user.passwordHash, input.currentPassword);
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect.', code: 'INVALID_CREDENTIALS' }, { status: 400 });
      }

      user.passwordHash = await hashPassword(input.newPassword);
      await user.save();
      return NextResponse.json({ message: 'Password updated successfully' });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // 5. Vault Setup
  if (pathStr === 'v1/vault/setup') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const body = await req.json();
      const input = VaultSetupSchema.parse(body);

      user.vaultMetadata = {
        salt: input.salt,
        kdfParams: input.kdfParams,
        keyVersion: input.keyVersion,
        wrappedDEK: input.wrappedDEK,
        nonce: input.nonce,
        recoverySalt: input.recoverySalt,
        recoveryWrappedDEK: input.recoveryWrappedDEK,
        recoveryNonce: input.recoveryNonce,
        isInitialized: true,
      };

      await user.save();
      return NextResponse.json({ message: 'Vault initialized successfully', isInitialized: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // 6. Vault Rekey
  if (pathStr === 'v1/vault/rekey') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const body = await req.json();
      const input = VaultSetupSchema.parse(body);

      if (!user.vaultMetadata) user.vaultMetadata = {} as any;
      user.vaultMetadata!.salt = input.salt;
      user.vaultMetadata!.kdfParams = input.kdfParams;
      user.vaultMetadata!.wrappedDEK = input.wrappedDEK;
      user.vaultMetadata!.nonce = input.nonce;
      user.vaultMetadata!.keyVersion = (user.vaultMetadata!.keyVersion || 1) + 1;

      await user.save();
      return NextResponse.json({ message: 'Vault re-keyed successfully', keyVersion: user.vaultMetadata!.keyVersion });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // 7. Create Entry: /v1/entries
  if (pathStr === 'v1/entries') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const body = await req.json();
      const input = CreateEntrySchema.parse(body);

      const entry = await Entry.create({
        owner: user._id,
        entryId: input.entryId,
        parentId: input.parentId || null,
        type: input.type,
        sortOrder: input.sortOrder || 0,
        encryptedPayload: input.encryptedPayload,
        nonce: input.nonce,
        aad: input.aad || '',
        cryptoVersion: input.cryptoVersion || '1.0',
        isFavorite: Boolean(input.isFavorite),
        isArchived: Boolean(input.isArchived),
        isDeleted: false,
        history: [],
      });

      return NextResponse.json({ entry: formatEntry(entry), message: 'Entry created successfully' }, { status: 201 });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // 8. Restore Entry: /v1/entries/:id/restore
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'entries' && path[3] === 'restore') {
    const id = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ owner: user._id, entryId: id });
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    entry.isDeleted = false;
    entry.deletedAt = null;
    await entry.save();
    return NextResponse.json({ entry: formatEntry(entry), message: 'Entry restored' });
  }

  // 9. Archive Entry: /v1/entries/:id/archive
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'entries' && path[3] === 'archive') {
    const id = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ owner: user._id, entryId: id });
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    entry.isArchived = !entry.isArchived;
    await entry.save();
    return NextResponse.json({ entry: formatEntry(entry), message: 'Archive status updated' });
  }

  // 10. Duplicate Entry: /v1/entries/:id/duplicate
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'entries' && path[3] === 'duplicate') {
    const id = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const source = await Entry.findOne({ owner: user._id, entryId: id });
    if (!source) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const newId = randomUUID();
    const duplicated = await Entry.create({
      owner: user._id,
      entryId: newId,
      parentId: source.parentId,
      type: source.type,
      sortOrder: source.sortOrder + 1,
      encryptedPayload: source.encryptedPayload,
      nonce: source.nonce,
      aad: source.aad,
      cryptoVersion: source.cryptoVersion,
      isFavorite: false,
      isArchived: false,
      isDeleted: false,
      history: [],
    });

    return NextResponse.json({ entry: formatEntry(duplicated), message: 'Entry duplicated' }, { status: 201 });
  }

  // 11. Move Entries: /v1/entries/move
  if (pathStr === 'v1/entries/move') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const moves = body.moves as Array<{ entryId: string; parentId?: string | null; sortOrder?: number }>;

    for (const m of moves || []) {
      const updateData: Record<string, any> = {};
      if (m.parentId !== undefined) updateData.parentId = m.parentId === 'root' ? null : m.parentId;
      if (m.sortOrder !== undefined) updateData.sortOrder = m.sortOrder;
      await Entry.updateOne({ owner: user._id, entryId: m.entryId }, { $set: updateData });
    }

    return NextResponse.json({ message: 'Entries moved successfully' });
  }

  // 12. Restore History Version: /v1/entries/:id/history/:versionId/restore
  if (path.length === 6 && path[0] === 'v1' && path[1] === 'entries' && path[3] === 'history' && path[5] === 'restore') {
    const id = path[2];
    const versionId = path[4];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ owner: user._id, entryId: id });
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const targetVersion = entry.history.find((h) => h._id?.toString() === versionId);
    if (!targetVersion) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });

    // Snapshot current state before restoring
    entry.history.push({
      encryptedPayload: entry.encryptedPayload,
      nonce: entry.nonce,
      updatedAt: new Date(),
    });

    entry.encryptedPayload = targetVersion.encryptedPayload;
    entry.nonce = targetVersion.nonce;
    await entry.save();

    return NextResponse.json({ entry: formatEntry(entry), message: 'History snapshot restored' });
  }

  // 13. Backup Restore: /v1/backup/restore
  if (pathStr === 'v1/backup/restore') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const backup = body.backup;
    if (!backup || !Array.isArray(backup.entries)) {
      return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 });
    }

    let count = 0;
    for (const e of backup.entries) {
      await Entry.updateOne(
        { owner: user._id, entryId: e.entryId },
        {
          $set: {
            parentId: e.parentId || null,
            type: e.type,
            sortOrder: e.sortOrder || 0,
            encryptedPayload: e.encryptedPayload,
            nonce: e.nonce,
            aad: e.aad || '',
            cryptoVersion: e.cryptoVersion || '1.0',
            isFavorite: Boolean(e.isFavorite),
            isArchived: Boolean(e.isArchived),
            isDeleted: Boolean(e.isDeleted),
          },
        },
        { upsert: true }
      );
      count++;
    }

    return NextResponse.json({ message: 'Backup restored successfully', restoredCount: count });
  }

  // 14. envAi Test Connection: /v1/envai/test
  if (pathStr === 'v1/envai/test') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const settings = await AiProviderSettings.findOne({ userId: user._id }).select('+encryptedApiKey +iv +tag');
    if (!settings || !settings.encryptedApiKey) {
      return NextResponse.json(
        {
          error: 'envAi is not configured. Please add your Gemini API key first.',
          code: 'NOT_CONFIGURED',
        },
        { status: 400 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback-envbook-secret-key-32bytes-min';
    let apiKey: string;
    try {
      apiKey = decryptProviderKey(
        {
          ciphertext: settings.encryptedApiKey,
          iv: settings.iv,
          tag: settings.tag,
        },
        jwtSecret
      );
    } catch {
      return NextResponse.json(
        {
          error: 'Failed to decrypt stored provider key. Please reconfigure your key.',
          code: 'DECRYPTION_FAILED',
        },
        { status: 500 }
      );
    }

    const testResult = await testGeminiApiKey(apiKey, settings.model || DEFAULT_GEMINI_MODEL);

    settings.lastTestedAt = new Date();
    settings.lastTestStatus = testResult.success ? 'success' : 'failed';
    settings.lastTestMessage = testResult.message;
    await settings.save();

    return NextResponse.json(testResult);
  }

  // 15. envAi Generate Content: /v1/envai/generate
  if (pathStr === 'v1/envai/generate') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parseResult = EnvAiGenerateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          details: parseResult.error.format(),
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Enforce resource type security restrictions
    if (!isResourceAllowed(body.currentNoteType)) {
      return NextResponse.json(
        {
          error: 'envAi cannot be used with environment variables or credential records for zero-knowledge privacy.',
          code: 'RESOURCE_DISALLOWED',
        },
        { status: 403 }
      );
    }

    const settings = await AiProviderSettings.findOne({ userId: user._id }).select('+encryptedApiKey +iv +tag');
    if (!settings || !settings.encryptedApiKey) {
      return NextResponse.json(
        {
          error: 'envAi is not configured. Please configure your Google Gemini API key in Settings → envAi.',
          code: 'NOT_CONFIGURED',
        },
        { status: 400 }
      );
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback-envbook-secret-key-32bytes-min';
    let apiKey: string;
    try {
      apiKey = decryptProviderKey(
        {
          ciphertext: settings.encryptedApiKey,
          iv: settings.iv,
          tag: settings.tag,
        },
        jwtSecret
      );
    } catch {
      return NextResponse.json(
        {
          error: 'Failed to decrypt provider key. Please reconfigure your key.',
          code: 'DECRYPTION_FAILED',
        },
        { status: 500 }
      );
    }

    // Workspace Retrieval if scope is "my_notes"
    const citations: Array<{ source: 'note' | 'file'; title: string; id?: string }> = [];
    const contextualNotes = input.contextText || '';

    if (input.scope === 'my_notes') {
      const eligibleEntries = await Entry.find({
        owner: user._id,
        type: { $in: ['notes_page', 'page', 'snippet', 'idea'] },
        isDeleted: false,
        isArchived: false,
      })
        .sort({ updatedAt: -1 })
        .limit(10);

      for (const entry of eligibleEntries) {
        citations.push({
          source: 'note',
          title: 'Note ' + entry.entryId.slice(0, 8),
          id: entry.entryId,
        });
      }
    }

    try {
      const result = await callGeminiApi({
        apiKey,
        model: settings.model || DEFAULT_GEMINI_MODEL,
        action: input.action,
        prompt: input.prompt,
        contextText: contextualNotes,
        tone: input.tone,
        citations,
        files: input.files,
        conversationHistory: input.conversationHistory,
      });

      return NextResponse.json({
        success: true,
        text: result.text,
        citations: result.citations,
        redactedCount: result.redactedCount,
      });
    } catch (err: any) {
      console.error('[envAi Next.js route] Generation error:', err.message);
      return NextResponse.json(
        {
          error: err.message || 'Failed to generate response from envAi',
          code: 'GENERATION_ERROR',
        },
        { status: 500 }
      );
    }
  }

  // Publish Page: /v1/pages/:pageId/publish
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'pages' && path[3] === 'publish') {
    const pageId = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Only the page owner can publish pages' }, { status: 403 });
    }

    if (entry.type === 'environment_page' || entry.type === 'credential' || entry.type.includes('env')) {
      return NextResponse.json({
        error: 'Secret-bearing environment pages and credentials cannot be published publicly.',
        code: 'SECRET_PUBLICATION_BLOCKED',
      }, { status: 400 });
    }

    try {
      const body = await req.json();
      const parsed = PublishPageSchema.parse(body);

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
        finalSlug = `${baseSlug}-${randomBytes(2).toString('hex')}`;
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

      // Notify collaborators
      for (const collab of share.collaborators) {
        await Notification.create({
          recipientId: collab.userId,
          actorId: user._id,
          actorName: user.username,
          type: 'page_published',
          pageId,
          pageTitle: parsed.title,
          message: `${user.username} published "${parsed.title}" to the web.`,
          isRead: false,
        });
      }

      return NextResponse.json({
        success: true,
        share: formatShareRecord(share, user._id.toString()),
        publishedUrl: `/p/${finalSlug}`,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Failed to publish page' }, { status: 400 });
    }
  }

  // Unpublish Page: /v1/pages/:pageId/unpublish
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'pages' && path[3] === 'unpublish') {
    const pageId = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Only the page owner can unpublish pages' }, { status: 403 });
    }

    const share = await PageShare.findOne({ pageId });
    if (share) {
      share.isPublished = false;
      share.publishedSlug = null;
      await share.save();

      for (const collab of share.collaborators) {
        await Notification.create({
          recipientId: collab.userId,
          actorId: user._id,
          actorName: user.username,
          type: 'page_unpublished',
          pageId,
          pageTitle: share.publishedTitle || 'Untitled Note',
          message: `${user.username} unpublished "${share.publishedTitle || 'Untitled Note'}".`,
          isRead: false,
        });
      }
    }

    return NextResponse.json({ success: true });
  }

  // Add Collaborator: /v1/pages/:pageId/collaborators
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'pages' && path[3] === 'collaborators') {
    const pageId = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Only the page owner can add collaborators' }, { status: 403 });
    }

    try {
      const body = await req.json();
      const parsed = AddCollaboratorSchema.parse(body);

      const targetUser = await User.findOne({
        $or: [
          { username: parsed.usernameOrEmail.toLowerCase() },
          { email: parsed.usernameOrEmail.toLowerCase() },
        ],
      });

      if (!targetUser) {
        return NextResponse.json({ error: 'User not found in EnvBook registry', code: 'USER_NOT_FOUND' }, { status: 404 });
      }

      if (targetUser._id.toString() === user._id.toString()) {
        return NextResponse.json({ error: 'You are already the owner of this page', code: 'CANNOT_ADD_SELF' }, { status: 400 });
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
        return NextResponse.json({ error: 'This user is already a collaborator on this page', code: 'ALREADY_COLLABORATOR' }, { status: 400 });
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

      await Notification.create({
        recipientId: targetUser._id,
        actorId: user._id,
        actorName: user.username,
        type: 'share_invite',
        pageId,
        pageTitle: share.publishedTitle || 'Untitled Note',
        message: `${user.username} shared "${share.publishedTitle || 'a note'}" with you as ${parsed.role}.`,
        isRead: false,
      });

      return NextResponse.json({ share: formatShareRecord(share, user._id.toString()) });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Failed to add collaborator' }, { status: 400 });
    }
  }

  return NextResponse.json({ error: 'Endpoint not found', path: pathStr }, { status: 404 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  await connectDB();

  // Update Entry: /v1/entries/:id
  if (path.length === 3 && path[0] === 'v1' && path[1] === 'entries') {
    const id = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ owner: user._id, entryId: id });
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    try {
      const body = await req.json();
      const input = UpdateEntrySchema.parse(body);

      // Snapshot version if payload changed
      if (input.encryptedPayload && input.encryptedPayload !== entry.encryptedPayload) {
        entry.history.push({
          encryptedPayload: entry.encryptedPayload,
          nonce: entry.nonce,
          updatedAt: new Date(),
        });
      }

      if (input.encryptedPayload) entry.encryptedPayload = input.encryptedPayload;
      if (input.nonce) entry.nonce = input.nonce;
      if (input.parentId !== undefined) {
        if (input.parentId === entry.entryId) {
          return NextResponse.json(
            { error: 'An entry cannot be its own parent.', code: 'CIRCULAR_REFERENCE' },
            { status: 400 }
          );
        }
        if (input.parentId !== null) {
          let currParentId: string | null = input.parentId;
          const visited = new Set<string>([entry.entryId]);
          while (currParentId) {
            if (visited.has(currParentId)) {
              return NextResponse.json(
                { error: 'Circular parent-child relationship detected.', code: 'CIRCULAR_REFERENCE' },
                { status: 400 }
              );
            }
            visited.add(currParentId);
            const parentDoc: any = await Entry.findOne({ owner: user._id, entryId: currParentId }).select('parentId');
            currParentId = parentDoc ? parentDoc.parentId : null;
          }
        }
        entry.parentId = input.parentId;
      }
      if (input.sortOrder !== undefined) entry.sortOrder = input.sortOrder;
      if (input.isFavorite !== undefined) entry.isFavorite = input.isFavorite;
      if (input.isArchived !== undefined) entry.isArchived = input.isArchived;

      await entry.save();
      return NextResponse.json({ entry: formatEntry(entry), message: 'Entry updated successfully' });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // envAi Config: /v1/envai/config
  const pathStr = path.join('/');
  if (pathStr === 'v1/envai/config') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parseResult = EnvAiConfigSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid configuration payload',
          details: parseResult.error.format(),
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const { apiKey, model = DEFAULT_GEMINI_MODEL } = parseResult.data;
    const jwtSecret = process.env.JWT_SECRET || 'fallback-envbook-secret-key-32bytes-min';

    const testResult = await testGeminiApiKey(apiKey, model);
    const { ciphertext, iv, tag, keyVersion } = encryptProviderKey(apiKey, jwtSecret);

    await AiProviderSettings.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        encryptedApiKey: ciphertext,
        iv,
        tag,
        keyVersion,
        model,
        lastTestedAt: new Date(),
        lastTestStatus: testResult.success ? 'success' : 'failed',
        lastTestMessage: testResult.message,
      },
      { upsert: true, new: true }
    );

    await logSecurityEvent('ENVAI_KEY_CONFIGURED', {
      userId: user._id,
      metadata: { model, testSuccess: testResult.success },
    });

    return NextResponse.json({
      success: true,
      isConfigured: true,
      testResult,
    });
  }

  // Update Public Link: /v1/pages/:pageId/share/public-link
  if (path.length === 5 && path[0] === 'v1' && path[1] === 'pages' && path[3] === 'share' && path[4] === 'public-link') {
    const pageId = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Only the page owner can configure public sharing' }, { status: 403 });
    }

    try {
      const body = await req.json();
      const parsed = SharePublicLinkSchema.parse(body);

      let share = await PageShare.findOne({ pageId });
      if (!share) {
        share = new PageShare({
          pageId,
          ownerId: entry.owner,
          collaborators: [],
        });
      }

      share.isPublicLinkEnabled = parsed.isEnabled;
      if (parsed.accessLevel) share.publicAccessLevel = parsed.accessLevel;
      if (parsed.isEnabled && !share.publicShareToken) {
        share.publicShareToken = randomBytes(24).toString('hex');
      }

      await share.save();
      return NextResponse.json({ share: formatShareRecord(share, user._id.toString()) });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // Update Collaborator: /v1/pages/:pageId/collaborators/:userId
  if (path.length === 5 && path[0] === 'v1' && path[1] === 'pages' && path[3] === 'collaborators') {
    const pageId = path[2];
    const targetUserId = path[4];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Only the page owner can update permissions' }, { status: 403 });
    }

    try {
      const body = await req.json();
      const parsed = UpdateCollaboratorSchema.parse(body);

      const share = await PageShare.findOne({ pageId });
      if (!share) return NextResponse.json({ error: 'Share record not found' }, { status: 404 });

      const collab = share.collaborators.find((c: any) => c.userId.toString() === targetUserId);
      if (!collab) return NextResponse.json({ error: 'Collaborator not found on this page' }, { status: 404 });

      collab.role = parsed.role;
      await share.save();

      await Notification.create({
        recipientId: collab.userId,
        actorId: user._id,
        actorName: user.username,
        type: 'permission_change',
        pageId,
        pageTitle: share.publishedTitle || 'Untitled Note',
        message: `Your permission for "${share.publishedTitle || 'Untitled Note'}" was updated to ${parsed.role}.`,
        isRead: false,
      });

      return NextResponse.json({ share: formatShareRecord(share, user._id.toString()) });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // Mark all notifications read: /v1/notifications/read-all
  if (pathStr === 'v1/notifications/read-all') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await Notification.updateMany({ recipientId: user._id, isRead: false }, { isRead: true });
    return NextResponse.json({ success: true });
  }

  // Mark specific notification read: /v1/notifications/:id/read
  if (path.length === 4 && path[0] === 'v1' && path[1] === 'notifications' && path[3] === 'read') {
    const notifId = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const notif = await Notification.findOneAndUpdate(
      { _id: notifId, recipientId: user._id },
      { isRead: true },
      { new: true }
    );
    if (!notif) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });

    return NextResponse.json({ success: true, notification: notif });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  await connectDB();

  const pathStr = path.join('/');

  // envAi Config Delete: /v1/envai/config
  if (pathStr === 'v1/envai/config') {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    await AiProviderSettings.findOneAndDelete({ userId: user._id });

    await logSecurityEvent('ENVAI_KEY_REMOVED', {
      userId: user._id,
    });

    return NextResponse.json({
      success: true,
      message: 'envAi provider configuration removed successfully.',
    });
  }

  // Delete Entry: /v1/entries/:id
  if (path.length === 3 && path[0] === 'v1' && path[1] === 'entries') {
    const id = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ owner: user._id, entryId: id });
    if (!entry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

    const url = new URL(req.url);
    const permanent = url.searchParams.get('permanent') === 'true';

    if (permanent) {
      await Entry.deleteOne({ _id: entry._id });
      await Entry.deleteMany({ owner: user._id, parentId: id });
      return NextResponse.json({ message: 'Entry permanently deleted', entryId: id });
    }

    entry.isDeleted = true;
    entry.deletedAt = new Date();
    await entry.save();

    await Entry.updateMany({ owner: user._id, parentId: id }, { $set: { isDeleted: true, deletedAt: new Date() } });
    return NextResponse.json({ message: 'Entry moved to Trash', entryId: id });
  }

  // Revoke Public Link: /v1/pages/:pageId/share/public-link
  if (path.length === 5 && path[0] === 'v1' && path[1] === 'pages' && path[3] === 'share' && path[4] === 'public-link') {
    const pageId = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Only the page owner can revoke public links' }, { status: 403 });
    }

    const share = await PageShare.findOne({ pageId });
    if (share) {
      share.isPublicLinkEnabled = false;
      share.publicShareToken = null;
      await share.save();
    }

    return NextResponse.json({ success: true });
  }

  // Remove Collaborator: /v1/pages/:pageId/collaborators/:userId
  if (path.length === 5 && path[0] === 'v1' && path[1] === 'pages' && path[3] === 'collaborators') {
    const pageId = path[2];
    const targetUserId = path[4];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const entry = await Entry.findOne({ entryId: pageId });
    if (!entry || entry.owner.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Only the page owner can remove collaborators' }, { status: 403 });
    }

    const share = await PageShare.findOne({ pageId });
    if (!share) return NextResponse.json({ error: 'Share record not found' }, { status: 404 });

    share.collaborators = share.collaborators.filter((c: any) => c.userId.toString() !== targetUserId);
    await share.save();

    await Notification.create({
      recipientId: targetUserId,
      actorId: user._id,
      actorName: user.username,
      type: 'access_revoked',
      pageId,
      pageTitle: share.publishedTitle || 'Untitled Note',
      message: `Your access to "${share.publishedTitle || 'Untitled Note'}" was revoked.`,
      isRead: false,
    });

    return NextResponse.json({ share: formatShareRecord(share, user._id.toString()) });
  }

  // Dismiss notification: /v1/notifications/:id
  if (path.length === 3 && path[0] === 'v1' && path[1] === 'notifications') {
    const notifId = path[2];
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await Notification.findOneAndDelete({ _id: notifId, recipientId: user._id });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
