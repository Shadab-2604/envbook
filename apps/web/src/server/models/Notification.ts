import mongoose, { Schema, Document, Types } from 'mongoose';
import { NOTIFICATION_TYPES, NotificationType } from '@envbook/shared';

export interface INotification extends Document {
  recipientId: Types.ObjectId;
  actorId: Types.ObjectId;
  actorName: string;
  type: NotificationType;
  pageId: string;
  pageTitle: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    pageId: {
      type: String,
      required: true,
    },
    pageTitle: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

export const Notification =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
