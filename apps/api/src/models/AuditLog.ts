import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: Types.ObjectId;
  eventType: string;
  recordId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    eventType: { type: String, required: true, index: true },
    recordId: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export async function logSecurityEvent(
  eventType: string,
  data: {
    userId?: Types.ObjectId;
    recordId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await AuditLog.create({
      eventType,
      userId: data.userId,
      recordId: data.recordId,
      ip: data.ip,
      userAgent: data.userAgent,
      metadata: data.metadata,
    });
  } catch (err) {
    // Audit logging should never crash the main application
    console.error('[AuditLog] Failed to record event:', (err as Error).message);
  }
}
