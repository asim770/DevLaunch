import mongoose from 'mongoose';
import { env } from './env.js';

let isConnecting = false;

/**
 * Returns human-readable connection status.
 */
export function getDatabaseStatus(): 'connected' | 'connecting' | 'disconnecting' | 'disconnected' {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'disconnected';
  }
}

/**
 * Checks whether MongoDB is actively connected.
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Connects to MongoDB with connection timeout settings.
 * Fails fast if connection cannot be established.
 * Does not log connection strings or credentials.
 */
export async function connectDatabase(): Promise<void> {
  if (isDatabaseConnected()) {
    return;
  }

  if (isConnecting) {
    return;
  }

  isConnecting = true;

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: env.NODE_ENV !== 'production',
    });

    console.info('[Database] MongoDB connection established successfully.');
  } catch (err) {
    console.error(
      '[Database Error] Failed to connect to MongoDB. Ensure the database server is running and reachable.'
    );
    throw err;
  } finally {
    isConnecting = false;
  }
}

/**
 * Safely disconnects Mongoose connection.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.info('[Database] MongoDB connection closed.');
  }
}
