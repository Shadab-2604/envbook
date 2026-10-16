import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Notification } from '../models/Notification.js';

export async function getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const notifications = await Notification.find({ recipientId: currentUserId })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipientId: currentUserId,
      isRead: false,
    });

    res.json({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const { id } = req.params;

    const notif = await Notification.findOneAndUpdate(
      { _id: id, recipientId: currentUserId },
      { isRead: true },
      { new: true }
    );

    if (!notif) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ success: true, notification: notif });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    await Notification.updateMany(
      { recipientId: currentUserId, isRead: false },
      { isRead: true }
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function dismissNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!._id.toString();
    const { id } = req.params;

    await Notification.findOneAndDelete({ _id: id, recipientId: currentUserId });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
