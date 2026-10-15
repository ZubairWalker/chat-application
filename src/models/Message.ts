import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IReadReceipt {
  user: Types.ObjectId;
  readAt: Date;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  room: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  readBy: IReadReceipt[];
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Room reference is required"],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender reference is required"],
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      maxlength: [4000, "Message cannot exceed 4000 characters"],
    },
    readBy: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isEdited: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound index for paginated message retrieval within a room
messageSchema.index({ room: 1, createdAt: -1 });

export const Message: Model<IMessage> = mongoose.model<IMessage>(
  "Message",
  messageSchema
);
