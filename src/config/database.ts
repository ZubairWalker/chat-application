import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function connectDB(): Promise<typeof mongoose> {
  const mongoURI = process.env.MONGODB_URI || process.env.mongodb;

  if (!mongoURI) {
    throw new Error(
      "MongoDB connection string is not defined. Please set MONGODB_URI in your environment variables."
    );
  }

  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`Connected to MongoDB successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    // Mid-level principle: Fail fast. Do NOT swallow connection errors on bootstrap!
    throw error;
  }
}

async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export { connectDB, disconnectDB, isDbConnected };