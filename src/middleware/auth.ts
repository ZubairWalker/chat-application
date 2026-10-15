import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export interface TokenPayload {
  userId: string;
  username: string;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not defined in environment variables. Set JWT_SECRET in .env"
    );
  }
  return secret;
};

/**
 * Generates a signed JWT for an authenticated user.
 */
export const generateToken = (
  payload: TokenPayload,
  expiresIn: string = "7d"
): string => {
  const options: SignOptions = {
    expiresIn: expiresIn as unknown as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, getJwtSecret(), options);
};

/**
 * Synchronously verifies a JWT token and returns decoded payload.
 */
export const verifyToken = (token: string): TokenPayload => {
  const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload & TokenPayload;
  if (!decoded.userId || !decoded.username) {
    throw new Error("Invalid token payload");
  }
  return {
    userId: decoded.userId,
    username: decoded.username,
  };
};

/**
 * Express middleware to guard authenticated HTTP routes.
 */
export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Unauthorized: Missing or malformed Authorization header. Expected 'Bearer <token>'.",
      });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: "Unauthorized: Invalid or expired token.",
      details: error instanceof Error ? error.message : undefined,
    });
  }
};
