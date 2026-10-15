import { Socket } from "socket.io";
import { verifyToken } from "./auth.js";

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    username: string;
  };
}

/**
 * Socket.IO authentication middleware.
 * Verifies JWT token supplied via `socket.handshake.auth.token`
 * or `socket.handshake.headers.authorization`.
 */
export const socketAuthMiddleware = (
  socket: Socket,
  next: (err?: Error) => void
): void => {
  try {
    let token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers?.authorization
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
        : null);

    if (!token || typeof token !== "string") {
      return next(new Error("Authentication error: Missing authentication token."));
    }

    // Verify token
    const decoded = verifyToken(token);

    // Attach decoded identity to socket.data
    socket.data.userId = decoded.userId;
    socket.data.username = decoded.username;

    next();
  } catch (error) {
    return next(
      new Error(
        `Authentication error: ${
          error instanceof Error ? error.message : "Invalid token."
        }`
      )
    );
  }
};
