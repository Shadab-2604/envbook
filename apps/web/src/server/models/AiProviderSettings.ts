import mongoose, { Schema, Document } from 'mongoose';

export interface IAiProviderSettings {
  userId: mongoose.Types.ObjectId;
  encryptedApiKey: string;
  iv: string;
  tag: string;
  keyVersion: number;
  model: string;
  lastTestedAt?: Date;
  lastTestStatus?: 'success' | 'failed' | 'untested';
  lastTestMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AiProviderSettingsSchema = new Schema<IAiProviderSettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    encryptedApiKey: {
      type: String,
      required: true,
      select: false,
    },
    iv: {
      type: String,
      required: true,
      select: false,
    },
    tag: {
      type: String,
      required: true,
      select: false,
    },
    keyVersion: {
      type: Number,
      default: 1,
    },
    model: {
      type: String,
      default: 'gemini-3.8-flash',
    },
    lastTestedAt: {
      type: Date,
    },
    lastTestStatus: {
      type: String,
      enum: ['success', 'failed', 'untested'],
      default: 'untested',
    },
    lastTestMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const AiProviderSettings =
  mongoose.models.AiProviderSettings ||
  mongoose.model<IAiProviderSettings>('AiProviderSettings', AiProviderSettingsSchema);
