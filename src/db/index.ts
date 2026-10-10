/* ============================================================
   Dexie Database — all Emoh data lives in IndexedDB
   No data ever leaves the device.
   ============================================================ */

import Dexie, { type Table } from 'dexie';
import type { JournalEntry, UserProfile } from '../types';

// Extend Dexie with our typed tables
class EmohDatabase extends Dexie {
  entries!: Table<JournalEntry, number>;
  profile!: Table<UserProfile, number>;

  constructor() {
    super('EmohDB');

    // Define the schema — only indexed fields need to be listed
    this.version(1).stores({
      entries: '++id, timestamp, mood',   // Auto-increment id, index by timestamp & mood
      profile: '++id',                    // Singleton row (id = 1)
    });
  }
}

// Single database instance for the entire app
export const db = new EmohDatabase();

/**
 * Retrieve the user profile (always id=1).
 * Returns null if onboarding hasn't completed.
 */
export async function getProfile(): Promise<UserProfile | undefined> {
  return db.profile.get(1);
}

/**
 * Save or update the user profile.
 * Uses put() so it creates or overwrites the row with id=1.
 */
export async function saveProfile(profile: Partial<UserProfile>): Promise<void> {
  await db.profile.put({ ...profile, id: 1 } as UserProfile);
}

/**
 * Add a new journal entry.
 * Returns the auto-generated id.
 */
export async function addEntry(entry: Omit<JournalEntry, 'id'>): Promise<number> {
  return db.entries.add(entry as JournalEntry);
}

/**
 * Get all entries, newest first.
 */
export async function getAllEntries(): Promise<JournalEntry[]> {
  return db.entries.orderBy('timestamp').reverse().toArray();
}

/**
 * Clear all journal entries while keeping the profile intact.
 */
export async function clearAllEntries(): Promise<void> {
  await db.entries.clear();
}

/**
 * Get the N most recent entries (for mood context).
 */
export async function getRecentEntries(count: number): Promise<JournalEntry[]> {
  return db.entries.orderBy('timestamp').reverse().limit(count).toArray();
}

/**
 * Update the feedback score on an entry.
 */
export async function updateFeedback(entryId: number, score: number): Promise<void> {
  await db.entries.update(entryId, { feedbackScore: score });
}

/**
 * Get all entries that have embeddings (for similarity search).
 */
export async function getEntriesWithEmbeddings(): Promise<JournalEntry[]> {
  return db.entries
    .filter((e) => e.embedding && e.embedding.length > 0)
    .toArray();
}

/**
 * Export all data as a plain object (for encrypted backup).
 */
export async function exportAllData(): Promise<{ entries: JournalEntry[]; profile: UserProfile | undefined }> {
  const entries = await db.entries.toArray();
  const profile = await getProfile();
  return { entries, profile };
}

/**
 * Import data from a backup, replacing all existing data.
 */
export async function importAllData(data: { entries: JournalEntry[]; profile: UserProfile }): Promise<void> {
  await db.transaction('rw', db.entries, db.profile, async () => {
    // Clear existing data
    await db.entries.clear();
    await db.profile.clear();
    // Restore from backup
    await db.entries.bulkAdd(data.entries);
    await db.profile.put(data.profile);
  });
}
