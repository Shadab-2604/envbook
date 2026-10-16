import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  eventType: string;
  userId?: Types.ObjectId;
  recordId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    eventType: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    recordId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export const AuditLog =
  (mongoose.models.AuditLog as mongoose.Model<IAuditLog>) ||
  mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export async function logSecurityEvent(
  eventType: string,
  data: {
    userId?: any;
    recordId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  try {
    await AuditLog.create({
      eventType,
      ...data,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('[AuditLog] Failed to record event:', err);
  }
}
