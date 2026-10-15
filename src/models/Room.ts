import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IRoom extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  isPrivate: boolean;
  members: Types.ObjectId[];
  admins: Types.ObjectId[];
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
      minlength: [2, "Room name must be at least 2 characters long"],
      maxlength: [50, "Room name cannot exceed 50 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [250, "Description cannot exceed 250 characters"],
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true, // Optimized for fast sorting of room lists by recent activity
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying user rooms ordered by lastActivity
roomSchema.index({ members: 1, lastActivity: -1 });

export const Room: Model<IRoom> = mongoose.model<IRoom>("Room", roomSchema);
