import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { CreateEntrySchema, UpdateEntrySchema, EntryRecord } from '@envbook/shared';
import { Entry, IEntry } from '../models/Entry.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logSecurityEvent } from '../models/AuditLog.js';

function formatEntry(entry: IEntry): EntryRecord {
  return {
    id: entry._id.toString(),
    entryId: entry.entryId,
    parentId: entry.parentId,
    type: entry.type,
    icon: entry.icon || null,
    sortOrder: entry.sortOrder,
    encryptedPayload: entry.encryptedPayload,
    nonce: entry.nonce,
    aad: entry.aad,
    cryptoVersion: entry.cryptoVersion,
    isFavorite: entry.isFavorite,
    isArchived: entry.isArchived,
    isDeleted: entry.isDeleted,
    deletedAt: entry.deletedAt ? entry.deletedAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    versionCount: entry.history?.length || 0,
  };
}

export async function getEntries(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = req.user!._id;
    const { type, parentId, isFavorite, isArchived, isDeleted } = req.query;

    const query: Record<string, any> = { owner };

    if (type) {
      query.type = type;
    }

    if (parentId !== undefined) {
      query.parentId = parentId === 'root' || parentId === '' ? null : parentId;
    }

    if (isFavorite !== undefined) {
      query.isFavorite = isFavorite === 'true';
    }

    if (isArchived !== undefined) {
      query.isArchived = isArchived === 'true';
    } else if (!isDeleted) {
      // By default hide archived entries from normal views unless explicitly requested
      query.isArchived = false;
    }

    if (isDeleted !== undefined) {
      query.isDeleted = isDeleted === 'true';
    } else {
      // By default do not return trash items
      query.isDeleted = false;
    }

    const entries = await Entry.find(query).sort({ sortOrder: 1, updatedAt: -1 });

    res.status(200).json({
      entries: entries.map(formatEntry),
      total: entries.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function getEntryById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = req.user!._id;
    const { id } = req.params;

    const entry = await Entry.findOne({ owner, entryId: id });
    if (!entry) {
      res.status(404).json({
        error: 'Entry not found or access denied.',
        code: 'ENTRY_NOT_FOUND',
      });
      return;
    }

    res.status(200).json({
      entry: formatEntry(entry),
    });
  } catch (err) {
    next(err);
  }
}

export async function createEntry(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = CreateEntrySchema.parse(req.body);
    const owner = req.user!._id;

    if (input.parentId && input.parentId === input.entryId) {
      res.status(400).json({
        error: 'An entry cannot be its own parent.',
        code: 'CIRCULAR_REFERENCE',
      });
      return;
    }

    const existing = await Entry.findOne({ owner, entryId: input.entryId });
    if (existing) {
      res.status(409).json({
        error: 'An entry with this ID already exists.',
        code: 'ENTRY_EXISTS',
      });
      return;
    }

    const entry = await Entry.create({
      owner,
      entryId: input.entryId,
      parentId: input.parentId || null,
      type: input.type,
      icon: input.icon || null,
      sortOrder: input.sortOrder ?? 0,
      encryptedPayload: input.encryptedPayload,
      nonce: input.nonce,
      aad: input.aad || '',
      cryptoVersion: input.cryptoVersion || '1.0',
      isFavorite: input.isFavorite ?? false,
      isArchived: input.isArchived ?? false,
      isDeleted: false,
      deletedAt: null,
      history: [],
    });

    res.status(201).json({
      entry: formatEntry(entry),
      message: 'Entry created successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function updateEntry(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = UpdateEntrySchema.parse(req.body);
    const owner = req.user!._id;
    const { id } = req.params;

    const entry = await Entry.findOne({ owner, entryId: id });
    if (!entry) {
      res.status(404).json({
        error: 'Entry not found or access denied.',
        code: 'ENTRY_NOT_FOUND',
      });
      return;
    }

    if (input.parentId !== undefined) {
      if (input.parentId === entry.entryId) {
        res.status(400).json({
          error: 'An entry cannot be its own parent.',
          code: 'CIRCULAR_REFERENCE',
        });
        return;
      }
      if (input.parentId !== null) {
        let currParentId: string | null = input.parentId;
        const visited = new Set<string>([entry.entryId]);
        while (currParentId) {
          if (visited.has(currParentId)) {
            res.status(400).json({
              error: 'Circular parent-child relationship detected.',
              code: 'CIRCULAR_REFERENCE',
            });
            return;
          }
          visited.add(currParentId);
          const parentDoc: any = await Entry.findOne({ owner, entryId: currParentId }).select('parentId');
          currParentId = parentDoc ? parentDoc.parentId : null;
        }
      }
      entry.parentId = input.parentId;
    }

    if (input.sortOrder !== undefined) {
      entry.sortOrder = input.sortOrder;
    }

    if (input.isFavorite !== undefined) {
      entry.isFavorite = input.isFavorite;
    }

    if (input.isArchived !== undefined) {
      entry.isArchived = input.isArchived;
    }

    if (input.icon !== undefined) {
      entry.icon = input.icon;
    }

    // Version history snapshot when payload changes
    if (input.encryptedPayload && input.encryptedPayload !== entry.encryptedPayload) {
      entry.history.push({
        encryptedPayload: entry.encryptedPayload,
        nonce: entry.nonce,
        updatedAt: entry.updatedAt,
      });

      // Keep max 20 version snapshots
      if (entry.history.length > 20) {
        entry.history.shift();
      }

      entry.encryptedPayload = input.encryptedPayload;
      if (input.nonce) entry.nonce = input.nonce;
      if (input.aad) entry.aad = input.aad;
    }

    await entry.save();

    res.status(200).json({
      entry: formatEntry(entry),
      message: 'Entry updated successfully',
    });
  } catch (err) {
    next(err);
  }
}

async function getAllDescendantEntryIds(owner: any, rootEntryId: string): Promise<string[]> {
  const descendantIds: string[] = [];
  const queue = [rootEntryId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await Entry.find({ owner, parentId }).select('entryId');
    for (const child of children) {
      descendantIds.push(child.entryId);
      queue.push(child.entryId);
    }
  }

  return descendantIds;
}

export async function deleteEntry(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = req.user!._id;
    const { id } = req.params;
    const permanent = req.query.permanent === 'true';

    const entry = await Entry.findOne({ owner, entryId: id });
    if (!entry) {
      res.status(404).json({
        error: 'Entry not found or access denied.',
        code: 'ENTRY_NOT_FOUND',
      });
      return;
    }

    const descendantIds = await getAllDescendantEntryIds(owner, id);

    if (permanent) {
      // Permanently remove entry and all nested descendants
      await Entry.deleteOne({ _id: entry._id });
      if (descendantIds.length > 0) {
        await Entry.deleteMany({ owner, entryId: { $in: descendantIds } });
      }

      await logSecurityEvent('ENTRY_PERMANENTLY_DELETED', {
        userId: owner,
        recordId: id,
      });

      res.status(200).json({
        message: 'Entry permanently deleted',
        entryId: id,
      });
      return;
    }

    // Soft delete to Trash and cascade to all nested descendants
    entry.isDeleted = true;
    entry.deletedAt = new Date();
    await entry.save();

    if (descendantIds.length > 0) {
      await Entry.updateMany(
        { owner, entryId: { $in: descendantIds } },
        { $set: { isDeleted: true, deletedAt: new Date() } }
      );
    }

    res.status(200).json({
      message: 'Entry moved to Trash',
      entryId: id,
    });
  } catch (err) {
    next(err);
  }
}

export async function restoreEntry(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = req.user!._id;
    const { id } = req.params;

    const entry = await Entry.findOne({ owner, entryId: id });
    if (!entry) {
      res.status(404).json({
        error: 'Entry not found or access denied.',
        code: 'ENTRY_NOT_FOUND',
      });
      return;
    }

    entry.isDeleted = false;
    entry.deletedAt = null;
    await entry.save();

    // If parent was also deleted, check if parent exists in active state, else attach to root
    if (entry.parentId) {
      const parent = await Entry.findOne({ owner, entryId: entry.parentId, isDeleted: false });
      if (!parent) {
        entry.parentId = null;
        await entry.save();
      }
    }

    // Cascade restore to all nested descendants
    const descendantIds = await getAllDescendantEntryIds(owner, id);
    if (descendantIds.length > 0) {
      await Entry.updateMany(
        { owner, entryId: { $in: descendantIds } },
        { $set: { isDeleted: false, deletedAt: null } }
      );
    }

    res.status(200).json({
      entry: formatEntry(entry),
      message: 'Entry restored successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function archiveEntry(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = req.user!._id;
    const { id } = req.params;

    const entry = await Entry.findOne({ owner, entryId: id });
    if (!entry) {
      res.status(404).json({
        error: 'Entry not found or access denied.',
        code: 'ENTRY_NOT_FOUND',
      });
      return;
    }

    entry.isArchived = !entry.isArchived;
    await entry.save();

    res.status(200).json({
      entry: formatEntry(entry),
      message: entry.isArchived ? 'Entry archived' : 'Entry unarchived',
    });
  } catch (err) {
    next(err);
  }
}

export async function duplicateEntry(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = req.user!._id;
    const { id } = req.params;

    const source = await Entry.findOne({ owner, entryId: id });
    if (!source) {
      res.status(404).json({
        error: 'Entry not found or access denied.',
        code: 'ENTRY_NOT_FOUND',
      });
      return;
    }

    const newEntryId = randomUUID();
    const duplicated = await Entry.create({
      owner,
      entryId: newEntryId,
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
      deletedAt: null,
      history: [],
    });

    res.status(201).json({
      entry: formatEntry(duplicated),
      message: 'Entry duplicated successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function moveEntries(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = req.user!._id;
    const { moves } = req.body as {
      moves: Array<{ entryId: string; parentId?: string | null; sortOrder?: number }>;
    };

    if (!Array.isArray(moves)) {
      res.status(400).json({
        error: 'Expected an array of move operations.',
        code: 'INVALID_INPUT',
      });
      return;
    }

    for (const move of moves) {
      if (move.parentId === move.entryId) continue;

      const updateData: Record<string, any> = {};
      if (move.parentId !== undefined) {
        updateData.parentId = move.parentId === 'root' ? null : move.parentId;
      }
      if (move.sortOrder !== undefined) {
        updateData.sortOrder = move.sortOrder;
      }

      await Entry.updateOne({ owner, entryId: move.entryId }, { $set: updateData });
    }

    res.status(200).json({
      message: 'Entries updated successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = req.user!._id;
    const { id } = req.params;

    const entry = await Entry.findOne({ owner, entryId: id });
    if (!entry) {
      res.status(404).json({
        error: 'Entry not found.',
        code: 'ENTRY_NOT_FOUND',
      });
      return;
    }

    res.status(200).json({
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
  } catch (err) {
    next(err);
  }
}

export async function restoreHistoryVersion(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = req.user!._id;
    const { id, versionId } = req.params;

    const entry = await Entry.findOne({ owner, entryId: id });
    if (!entry) {
      res.status(404).json({
        error: 'Entry not found.',
        code: 'ENTRY_NOT_FOUND',
      });
      return;
    }

    const version = entry.history.find((h) => h._id?.toString() === versionId);
    if (!version) {
      res.status(404).json({
        error: 'Version snapshot not found.',
        code: 'VERSION_NOT_FOUND',
      });
      return;
    }

    // Save current as a snapshot before replacing
    entry.history.push({
      encryptedPayload: entry.encryptedPayload,
      nonce: entry.nonce,
      updatedAt: entry.updatedAt,
    });

    entry.encryptedPayload = version.encryptedPayload;
    entry.nonce = version.nonce;
    await entry.save();

    res.status(200).json({
      entry: formatEntry(entry),
      message: 'Version restored successfully',
    });
  } catch (err) {
    next(err);
  }
}
