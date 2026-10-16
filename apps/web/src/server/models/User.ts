import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  vaultMetadata?: {
    salt: string;
    kdfParams: {
      memoryCost: number;
      timeCost: number;
      parallelism: number;
    };
    keyVersion: number;
    wrappedDEK: string;
    nonce: string;
    recoverySalt?: string;
    recoveryWrappedDEK?: string;
    recoveryNonce?: string;
    isInitialized: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    vaultMetadata: {
      salt: { type: String },
      kdfParams: {
        memoryCost: { type: Number },
        timeCost: { type: Number },
        parallelism: { type: Number },
      },
      keyVersion: { type: Number, default: 1 },
      wrappedDEK: { type: String },
      nonce: { type: String },
      recoverySalt: { type: String },
      recoveryWrappedDEK: { type: String },
      recoveryNonce: { type: String },
      isInitialized: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

export const User = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);
