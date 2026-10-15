import mongoose, { Document, Model, Schema, Types } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  password?: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  toPublicJSON(): Record<string, any>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [30, "Username cannot exceed 30 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Security: Never leak password hashes in queries by default
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: Hash password with bcrypt before saving if modified
userSchema.pre<IUser>("save", async function () {
  if (!this.isModified("password") || !this.password) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method: Securely compare candidate password with hash
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method: Return safe public projection
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt,
  };
};

export const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
