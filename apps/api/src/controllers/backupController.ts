import { Response, NextFunction } from 'express';
import { Entry } from '../models/Entry.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logSecurityEvent } from '../models/AuditLog.js';

export async function exportBackup(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;
    const owner = user._id;

    const entries = await Entry.find({ owner, isDeleted: false });

    const backupData = {
      app: 'EnvBook',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      vaultMetadata: user.vaultMetadata,
      entries: entries.map((e) => ({
        entryId: e.entryId,
        parentId: e.parentId,
        type: e.type,
        sortOrder: e.sortOrder,
        encryptedPayload: e.encryptedPayload,
        nonce: e.nonce,
        aad: e.aad,
        cryptoVersion: e.cryptoVersion,
        isFavorite: e.isFavorite,
        isArchived: e.isArchived,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
    };

    await logSecurityEvent('VAULT_BACKUP_EXPORTED', {
      userId: owner,
      ip: req.ip,
      metadata: { count: entries.length },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="envbook_encrypted_backup.json"');
    res.status(200).json(backupData);
  } catch (err) {
    next(err);
  }
}

export async function restoreBackup(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;
    const owner = user._id;
    const { backup } = req.body;

    if (!backup || typeof backup !== 'object' || !Array.isArray(backup.entries)) {
      res.status(400).json({
        error: 'Invalid backup structure. Missing entries array.',
        code: 'INVALID_BACKUP',
      });
      return;
    }

    let restoredCount = 0;

    for (const item of backup.entries) {
      if (!item.entryId || !item.encryptedPayload || !item.nonce) {
        continue;
      }

      await Entry.findOneAndUpdate(
        { owner, entryId: item.entryId },
        {
          $set: {
            parentId: item.parentId || null,
            type: item.type || 'page',
            sortOrder: item.sortOrder || 0,
            encryptedPayload: item.encryptedPayload,
            nonce: item.nonce,
            aad: item.aad || '',
            cryptoVersion: item.cryptoVersion || '1.0',
            isFavorite: Boolean(item.isFavorite),
            isArchived: Boolean(item.isArchived),
            isDeleted: false,
            deletedAt: null,
          },
        },
        { upsert: true, new: true }
      );
      restoredCount++;
    }

    await logSecurityEvent('VAULT_BACKUP_RESTORED', {
      userId: owner,
      ip: req.ip,
      metadata: { restoredCount },
    });

    res.status(200).json({
      message: `Successfully restored ${restoredCount} encrypted entries.`,
      restoredCount,
    });
  } catch (err) {
    next(err);
  }
}
