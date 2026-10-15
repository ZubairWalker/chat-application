import http from "node:http";
import path from "node:path";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import { connectDB, disconnectDB, isDbConnected } from "./config/database.js";
import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";
import { socketAuthMiddleware } from "./middleware/socketAuth.js";
import { registerChatHandlers } from "./socket/chatHandlers.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS support
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Attach Socket.IO authentication middleware & event listeners
io.use(socketAuthMiddleware);
registerChatHandlers(io);

// Security & Parsing Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Permissive for local testing via public/
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/ for manual Socket.IO testing
app.use(express.static(path.resolve(process.cwd(), "public")));

// Root route
app.get("/", (_req, res) => {
  res.status(200).json({ message: "Welcome to Chat Application API" });
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
  const dbStatus = isDbConnected();
  res.status(dbStatus ? 200 : 503).json({
    status: dbStatus ? "ok" : "degraded",
    database: dbStatus ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

// Centralized error and 404 handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Fatal error during server startup:", error);
    process.exit(1);
  }
};

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log("Closed HTTP & Socket.IO server.");
    try {
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error("Error during database disconnect:", err);
      process.exit(1);
    }
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { app, server, io };

// Boot server
startServer();
