import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'user' | 'admin';
export type AuthProvider = 'local' | 'google';

export const BCRYPT_SALT_ROUNDS = 12;

export interface IUser {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  providers: AuthProvider[];
  googleId?: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
  tokenVersion: number;
  passwordResetOtpHash?: string;
  passwordResetOtpExpires?: Date;
  passwordResetOtpAttempts?: number;
  passwordResetLastSent?: Date;
  passwordResetTokenHash?: string;
  passwordResetTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export type UserModel = Model<IUser, Record<string, never>, IUserMethods>;

export type UserDocument = Document<unknown, Record<string, never>, IUser> &
  IUser &
  IUserMethods & {
    _id: mongoose.Types.ObjectId;
  };

/**
 * Mongoose Schema for DevLaunch User.
 *
 * NOTE ON INDEXES & UNIQUENESS:
 * - Email uniqueness is enforced at the database level via `unique: true`.
 * - Google ID uniqueness applies only when present via `unique: true, sparse: true`.
 * - In MongoDB, database-level uniqueness requires active MongoDB unique indexes.
 *   In development, Mongoose builds these via `autoIndex: true`.
 *   In production, ensure indexes are built during migration/deployment.
 */
export const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [50, 'Name cannot exceed 50 characters long'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // Creates unique index in MongoDB. Avoid redundant schema.index() calls.
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: false, // Optional at schema level for Google OAuth accounts; enforced by local auth routes
      select: false, // Excluded from default queries to prevent accidental leakage
      minlength: [8, 'Password must be at least 8 characters long'],
      maxlength: [128, 'Password cannot exceed 128 characters long'],
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: '{VALUE} is not a valid user role',
      },
      default: 'user',
    },
    providers: {
      type: [String],
      enum: {
        values: ['local', 'google'],
        message: '{VALUE} is not a valid auth provider',
      },
      default: ['local'],
    },
    googleId: {
      type: String,
      unique: true, // Unique index
      sparse: true, // Applies uniqueness only when value is not null/undefined
      select: false, // Excluded from default queries
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      select: false, // Excluded from default queries
    },
    passwordResetOtpHash: {
      type: String,
      select: false,
    },
    passwordResetOtpExpires: {
      type: Date,
      select: false,
    },
    passwordResetOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    passwordResetLastSent: {
      type: Date,
      select: false,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
      index: true,
      sparse: true,
    },
    passwordResetTokenExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret._id != null ? String(ret._id) : ret.id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.googleId;
        delete ret.tokenVersion;
        delete ret.passwordResetOtpHash;
        delete ret.passwordResetOtpExpires;
        delete ret.passwordResetOtpAttempts;
        delete ret.passwordResetLastSent;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetTokenExpires;
        ret.id = id;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret._id != null ? String(ret._id) : ret.id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.googleId;
        delete ret.tokenVersion;
        delete ret.passwordResetOtpHash;
        delete ret.passwordResetOtpExpires;
        delete ret.passwordResetOtpAttempts;
        delete ret.passwordResetLastSent;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetTokenExpires;
        ret.id = id;
        return ret;
      },
    },
  }
);

/**
 * Pre-save middleware: Hashes the password using bcryptjs with 12 salt rounds
 * only when the password field has been added or modified.
 */
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }

  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compares a candidate plaintext password with the stored hash using bcrypt.
 * Safely returns false if no password hash is loaded on the document.
 */
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

export const User: UserModel =
  (mongoose.models.User as UserModel) || mongoose.model<IUser, UserModel>('User', userSchema);
