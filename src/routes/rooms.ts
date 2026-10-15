import { Router, Response } from "express";
import mongoose from "mongoose";
import { Room } from "../models/Room.js";
import { Message } from "../models/Message.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Apply authentication guard to all room routes
router.use(authMiddleware);

/**
 * GET /api/rooms
 * Returns public rooms and private rooms where the requester is an enrolled member,
 * ordered chronologically by most recent activity.
 */
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    const rooms = await Room.find({
      $or: [{ isPrivate: false }, { members: userId }],
    })
      .sort({ lastActivity: -1 })
      .populate("members", "username isOnline lastSeen")
      .populate("admins", "username isOnline");

    res.status(200).json({ rooms });
  } catch (error) {
    res.status(500).json({
      error: "Failed to retrieve rooms.",
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

/**
 * POST /api/rooms
 * Creates a new chat room and designates creator as member and admin.
 */
router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { name, description, isPrivate } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      res.status(400).json({
        error: "Validation failed: 'name' must be at least 2 characters long.",
      });
      return;
    }

    const creatorId = new mongoose.Types.ObjectId(userId);

    const room = new Room({
      name: name.trim(),
      description: description ? description.trim() : "",
      isPrivate: Boolean(isPrivate),
      members: [creatorId],
      admins: [creatorId],
      lastActivity: new Date(),
    });

    await room.save();
    await room.populate("members admins", "username isOnline");

    res.status(201).json({
      message: "Room created successfully.",
      room,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to create room.",
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

/**
 * GET /api/rooms/:roomId/messages
 * Retrieves paginated messages for a room.
 * Ensures the requester has permission to read the room.
 * DB fetches newest first for indexing performance, but returns chronologically for client UI.
 */
router.get("/:roomId/messages", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rawRoomId = req.params.roomId;
    const roomId = Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId;
    const userId = req.user?.userId;

    if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
      res.status(400).json({ error: "Invalid roomId format." });
      return;
    }

    const room = await Room.findById(roomId);
    if (!room) {
      res.status(404).json({ error: "Room not found." });
      return;
    }

    // Access check: If room is private, user must be an active member
    if (room.isPrivate) {
      const isMember = room.members.some((m) => m.toString() === userId);
      if (!isMember) {
        res.status(403).json({
          error: "Forbidden: You are not a member of this private room.",
        });
        return;
      }
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const skip = (page - 1) * limit;

    const [total, rawMessages] = await Promise.all([
      Message.countDocuments({ room: roomId }),
      Message.find({ room: roomId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("sender", "username isOnline")
        .populate("readBy.user", "username"),
    ]);

    // Reverse to chronological order (oldest to newest) for client display
    const chronologicalMessages = [...rawMessages].reverse();

    res.status(200).json({
      messages: chronologicalMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch room messages.",
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

export default router;
