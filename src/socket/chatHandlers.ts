import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Room } from "../models/Room.js";
import { Message } from "../models/Message.js";

interface SendMessagePayload {
  roomId: string;
  content: string;
}

interface TypingPayload {
  roomId: string;
  isTyping: boolean;
}

interface RoomActionPayload {
  roomId: string;
}

interface MessageReadPayload {
  messageId: string;
  roomId: string;
}

export const registerChatHandlers = (io: Server): void => {
  io.on("connection", async (socket: Socket) => {
    const userId = socket.data.userId as string;
    const username = socket.data.username as string;

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    console.log(`🔌 User connected: ${username} (${userId}) [Socket: ${socket.id}]`);

    try {
      // 1. Mark user as online in database
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
        lastSeen: new Date(),
      });

      // 2. Join private socket channel for direct messages/notifications
      socket.join(`user:${userId}`);

      // 3. Automatically join all accessible rooms (public or where member)
      const accessibleRooms = await Room.find({
        $or: [{ isPrivate: false }, { members: userId }],
      }).select("_id");

      accessibleRooms.forEach((room) => {
        socket.join(room._id.toString());
      });

      // 4. Broadcast user presence
      socket.broadcast.emit("user-online", {
        userId,
        username,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error initializing socket connection for user:", error);
    }

    // ----------------------------------------------------
    // Event: send-message
    // ----------------------------------------------------
    socket.on("send-message", async (payload: SendMessagePayload, callback?) => {
      try {
        const { roomId, content } = payload;

        if (!roomId || !content || !content.trim()) {
          const errResponse = { error: "Both 'roomId' and non-empty 'content' are required." };
          if (callback) callback(errResponse);
          socket.emit("error", errResponse);
          return;
        }

        if (!mongoose.Types.ObjectId.isValid(roomId)) {
          const errResponse = { error: "Invalid roomId format." };
          if (callback) callback(errResponse);
          socket.emit("error", errResponse);
          return;
        }

        const room = await Room.findById(roomId);
        if (!room) {
          const errResponse = { error: "Room not found." };
          if (callback) callback(errResponse);
          socket.emit("error", errResponse);
          return;
        }

        // Access check
        if (room.isPrivate) {
          const isMember = room.members.some((m) => m.toString() === userId);
          if (!isMember) {
            const errResponse = { error: "Forbidden: You are not a member of this room." };
            if (callback) callback(errResponse);
            socket.emit("error", errResponse);
            return;
          }
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Create and save message
        const message = new Message({
          room: room._id,
          sender: userObjectId,
          content: content.trim(),
          readBy: [
            {
              user: userObjectId,
              readAt: new Date(),
            },
          ],
        });

        await message.save();

        // Update room's last activity
        room.lastActivity = new Date();
        await room.save();

        // Populate sender info for client consumption
        await message.populate("sender", "username isOnline");

        // Broadcast to all clients in the room
        io.to(roomId).emit("new-message", message);

        if (callback) {
          callback({ status: "ok", message });
        }
      } catch (error) {
        console.error("Error in 'send-message' handler:", error);
        socket.emit("error", { error: "Failed to send message." });
      }
    });

    // ----------------------------------------------------
    // Event: typing
    // ----------------------------------------------------
    socket.on("typing", (payload: TypingPayload) => {
      try {
        const { roomId, isTyping } = payload;
        if (!roomId) return;

        // Broadcast to everyone else in the room
        socket.to(roomId).emit("user-typing", {
          roomId,
          userId,
          username,
          isTyping: Boolean(isTyping),
        });
      } catch (error) {
        console.error("Error in 'typing' handler:", error);
      }
    });

    // ----------------------------------------------------
    // Event: join-room
    // ----------------------------------------------------
    socket.on("join-room", async (payload: RoomActionPayload, callback?) => {
      try {
        const { roomId } = payload;
        if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
          const errResponse = { error: "Valid roomId is required." };
          if (callback) callback(errResponse);
          socket.emit("error", errResponse);
          return;
        }

        const room = await Room.findById(roomId);
        if (!room) {
          const errResponse = { error: "Room does not exist." };
          if (callback) callback(errResponse);
          socket.emit("error", errResponse);
          return;
        }

        if (room.isPrivate) {
          const isMember = room.members.some((m) => m.toString() === userId);
          if (!isMember) {
            const errResponse = { error: "Access denied to private room." };
            if (callback) callback(errResponse);
            socket.emit("error", errResponse);
            return;
          }
        }

        socket.join(roomId);

        // Notify room members
        io.to(roomId).emit("user-joined-room", {
          roomId,
          userId,
          username,
          timestamp: new Date(),
        });

        if (callback) callback({ status: "ok", roomId });
      } catch (error) {
        console.error("Error in 'join-room' handler:", error);
        socket.emit("error", { error: "Failed to join room." });
      }
    });

    // ----------------------------------------------------
    // Event: leave-room
    // ----------------------------------------------------
    socket.on("leave-room", (payload: RoomActionPayload, callback?) => {
      try {
        const { roomId } = payload;
        if (!roomId) return;

        socket.leave(roomId);

        io.to(roomId).emit("user-left-room", {
          roomId,
          userId,
          username,
          timestamp: new Date(),
        });

        if (callback) callback({ status: "ok", roomId });
      } catch (error) {
        console.error("Error in 'leave-room' handler:", error);
      }
    });

    // ----------------------------------------------------
    // Event: message-read
    // ----------------------------------------------------
    socket.on("message-read", async (payload: MessageReadPayload, callback?) => {
      try {
        const { messageId, roomId } = payload;
        if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
          return;
        }

        const message = await Message.findById(messageId);
        if (!message) return;

        const alreadyRead = message.readBy.some((r) => r.user.toString() === userId);

        if (!alreadyRead) {
          const readAt = new Date();
          message.readBy.push({
            user: new mongoose.Types.ObjectId(userId),
            readAt,
          });
          await message.save();

          io.to(roomId || message.room.toString()).emit("message-read", {
            messageId,
            roomId: roomId || message.room.toString(),
            userId,
            readAt,
          });
        }

        if (callback) callback({ status: "ok" });
      } catch (error) {
        console.error("Error in 'message-read' handler:", error);
      }
    });

    // ----------------------------------------------------
    // Event: disconnect
    // ----------------------------------------------------
    socket.on("disconnect", async () => {
      console.log(`❌ User disconnected: ${username} (${userId})`);
      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });

        socket.broadcast.emit("user-offline", {
          userId,
          username,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Error handling user disconnect:", error);
      }
    });
  });
};
