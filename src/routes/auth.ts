import { Router, Response } from "express";
import { User } from "../models/User.js";
import { generateToken, authMiddleware, AuthRequest } from "../middleware/auth.js";

const router = Router();

/**
 * POST /api/auth/register
 * Registers a new user account.
 */
router.post("/register", async (req, res): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Basic body validation
    if (!username || !email || !password) {
      res.status(400).json({
        error: "Validation failed: 'username', 'email', and 'password' are required.",
      });
      return;
    }

    if (username.length < 3) {
      res.status(400).json({
        error: "Username must be at least 3 characters long.",
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        error: "Password must be at least 6 characters long.",
      });
      return;
    }

    // Check uniqueness
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });

    if (existingUser) {
      res.status(409).json({
        error: "A user with this email or username already exists.",
      });
      return;
    }

    // Create user (password is automatically hashed via pre-save hook)
    const newUser = new User({
      username,
      email: email.toLowerCase(),
      password,
    });

    await newUser.save();

    const token = generateToken({
      userId: newUser._id.toString(),
      username: newUser.username,
    });

    res.status(201).json({
      message: "User registered successfully.",
      token,
      user: newUser.toPublicJSON(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error during registration.",
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user credentials and issues a JWT.
 */
router.post("/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: "Validation failed: 'email' and 'password' are required.",
      });
      return;
    }

    // Explicitly select password since it has select: false on schema
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    // Update presence
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = generateToken({
      userId: user._id.toString(),
      username: user.username,
    });

    res.status(200).json({
      message: "Login successful.",
      token,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error during login.",
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user's profile.
 */
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    res.status(200).json({ user: user.toPublicJSON() });
  } catch (error) {
    res.status(500).json({
      error: "Internal server error retrieving user profile.",
      details: error instanceof Error ? error.message : undefined,
    });
  }
});

export default router;
