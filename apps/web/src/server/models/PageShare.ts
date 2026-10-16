import mongoose, { Schema, Document, Types } from 'mongoose';
import { CollaboratorRole } from '@envbook/shared';

export interface ICollaborator {
  userId: Types.ObjectId;
  username: string;
  email: string;
  name?: string;
  role: CollaboratorRole;
  invitedAt: Date;
}

export interface IPageShare extends Document {
  pageId: string;
  ownerId: Types.ObjectId;
  isPublicLinkEnabled: boolean;
  publicShareToken: string | null;
  publicAccessLevel: CollaboratorRole;
  isPublished: boolean;
  publishedSlug: string | null;
  publishedTitle: string;
  publishedContent: string;
  publishedAt: Date | null;
  collaborators: ICollaborator[];
  createdAt: Date;
  updatedAt: Date;
}

const CollaboratorSchema = new Schema<ICollaborator>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String },
    role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' },
    invitedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PageShareSchema = new Schema<IPageShare>(
  {
    pageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    isPublicLinkEnabled: {
      type: Boolean,
      default: false,
    },
    publicShareToken: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    publicAccessLevel: {
      type: String,
      enum: ['viewer', 'editor'],
      default: 'viewer',
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedSlug: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
      index: true,
    },
    publishedTitle: {
      type: String,
      default: '',
    },
    publishedContent: {
      type: String,
      default: '',
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    collaborators: {
      type: [CollaboratorSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const PageShare =
  mongoose.models.PageShare || mongoose.model<IPageShare>('PageShare', PageShareSchema);
