import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { connectDatabase, disconnectDatabase } from './database.js';

/**
 * Initializes and synchronizes database indexes for staging and production environments.
 * Safe to execute idempotently: builds missing unique indexes without dropping existing collections.
 */
export async function initDatabaseIndexes(): Promise<string[]> {
  console.info('[Database Indexer] Synchronizing User collection indexes...');
  const createdIndexes = await User.createIndexes();
  console.info('[Database Indexer] Indexes synchronized successfully.');
  return Array.isArray(createdIndexes) ? createdIndexes : [];
}

// Standalone execution entrypoint
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*[/\\]/, ''))) {
  (async () => {
    try {
      await connectDatabase();
      const dbName = mongoose.connection.name || 'unknown';
      const dbHost = mongoose.connection.host || 'unknown';
      console.info(`[Database Indexer] Target Database: "${dbName}" on host "${dbHost}".`);
      await initDatabaseIndexes();
      await disconnectDatabase();
      console.info('[Database Indexer] Index initialization completed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('[Database Indexer Error] Failed to synchronize indexes:', err);
      process.exit(1);
    }
  })();
}
