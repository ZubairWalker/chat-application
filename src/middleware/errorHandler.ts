import { Request, Response, NextFunction } from "express";

/**
 * 404 Handler for undefined routes.
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

/**
 * Centralized Global Error Handler.
 * Catches Mongoose errors, validation errors, and uncaught exceptions.
 */
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error("Unhandled API Error:", err);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    res.status(400).json({
      error: "Validation Error",
      details: Object.values(err.errors || {}).map((e: any) => e.message),
    });
    return;
  }

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    res.status(409).json({
      error: `Duplicate value entered for ${fields.join(", ")}. Please use another value.`,
    });
    return;
  }

  // Mongoose invalid ObjectId cast error
  if (err.name === "CastError") {
    res.status(400).json({
      error: `Invalid resource identifier format for '${err.path}'.`,
    });
    return;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    res.status(401).json({
      error: "Authentication failed: Invalid or expired token.",
    });
    return;
  }

  // Fallback 500
  const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
  res.status(statusCode).json({
    error: err.message || "Internal Server Error",
  });
};
