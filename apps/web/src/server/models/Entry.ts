import mongoose, { Schema, Document, Types } from 'mongoose';
import { ENTRY_TYPES, EntryType } from '@envbook/shared';

export interface IEntryHistory {
  _id?: Types.ObjectId;
  encryptedPayload: string;
  nonce: string;
  updatedAt: Date;
}

export interface IEntry extends Document {
  owner: Types.ObjectId;
  entryId: string;
  parentId: string | null;
  type: EntryType;
  sortOrder: number;
  encryptedPayload: string;
  nonce: string;
  aad: string;
  cryptoVersion: string;
  isFavorite: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  history: IEntryHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const EntryHistorySchema = new Schema<IEntryHistory>(
  {
    encryptedPayload: { type: String, required: true },
    nonce: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const EntrySchema = new Schema<IEntry>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    entryId: {
      type: String,
      required: true,
      index: true,
    },
    parentId: {
      type: String,
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ENTRY_TYPES,
      required: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    encryptedPayload: {
      type: String,
      required: true,
    },
    nonce: {
      type: String,
      required: true,
    },
    aad: {
      type: String,
      default: '',
    },
    cryptoVersion: {
      type: String,
      default: '1.0',
    },
    isFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    history: {
      type: [EntryHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

EntrySchema.index({ owner: 1, entryId: 1 }, { unique: true });
EntrySchema.index({ owner: 1, parentId: 1, isDeleted: 1, sortOrder: 1 });
EntrySchema.index({ owner: 1, isDeleted: 1, isArchived: 1, updatedAt: -1 });
EntrySchema.index({ owner: 1, type: 1, isDeleted: 1 });
EntrySchema.index({ owner: 1, isFavorite: 1, isDeleted: 1 });

export const Entry =
  (mongoose.models.Entry as mongoose.Model<IEntry>) || mongoose.model<IEntry>('Entry', EntrySchema);
