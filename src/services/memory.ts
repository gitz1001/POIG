/* ============================================================
   Memory Service — RAG logic for retrieving relevant past entries
   ============================================================ */

import { getEntriesWithEmbeddings, getRecentEntries } from '../db';
import type { JournalEntry } from '../types';

/**
 * Calculate dot product between two vectors.
 * Assumes vectors are normalized.
 */
function dotProduct(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

/**
 * Retrieve the top K most relevant past journal entries based on cosine similarity
 * of the user's current input embedding.
 */
export async function getRelevantMemories(queryEmbedding: number[], topK: number = 3): Promise<JournalEntry[]> {
  const allEntries = await getEntriesWithEmbeddings();
  
  if (allEntries.length === 0) return [];

  const scoredEntries = allEntries.map(entry => {
    return {
      entry,
      score: dotProduct(queryEmbedding, entry.embedding)
    };
  });

  // Sort descending by score
  scoredEntries.sort((a, b) => b.score - a.score);

  return scoredEntries.slice(0, topK).map(s => s.entry);
}

/**
 * Get recent mood context (last N entries).
 */
export async function getMoodContext(count: number = 5): Promise<string[]> {
  const recent = await getRecentEntries(count);
  // Return moods in chronological order (oldest first in the context window)
  return recent.map(r => r.mood).reverse();
}

/**
 * Analyze mood trend from a list of recent moods.
 * Simple heuristic for demonstration.
 */
export function analyzeMoodTrend(moods: string[]): 'improving' | 'declining' | 'stable' {
  if (moods.length < 2) return 'stable';
  
  const negativeMoods = ['sad', 'anxious', 'angry'];
  const positiveMoods = ['happy', 'calm'];
  
  const first = moods[0]; // oldest
  const last = moods[moods.length - 1]; // newest
  
  if (negativeMoods.includes(first) && positiveMoods.includes(last)) return 'improving';
  if (positiveMoods.includes(first) && negativeMoods.includes(last)) return 'declining';
  
  return 'stable';
}
