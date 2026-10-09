/* ============================================================
   Bible Service — Loads verse data and embeddings, matches via dot product
   ============================================================ */

import type { BibleVerse } from '../types';

let verses: BibleVerse[] | null = null;
let embeddings: Float32Array | null = null;
const EMBEDDING_DIM = 384;

/**
 * Load Bible data and embeddings from public folder.
 */
export async function initBible(): Promise<void> {
  if (verses && embeddings) return;

  try {
    const [versesRes, embeddingsRes] = await Promise.all([
      fetch('/bible.json'),
      fetch('/bible-embeddings.bin')
    ]);

    if (!versesRes.ok || !embeddingsRes.ok) {
      throw new Error('Failed to load Bible data');
    }

    verses = await versesRes.json() as BibleVerse[];
    
    // Embeddings are stored as a flat binary array of 32-bit floats
    const arrayBuffer = await embeddingsRes.arrayBuffer();
    embeddings = new Float32Array(arrayBuffer);

    if (verses.length * EMBEDDING_DIM !== embeddings.length) {
      throw new Error('Bible verses and embeddings length mismatch');
    }
  } catch (err) {
    console.error('Bible initialization error:', err);
    // Don't throw, just allow app to run without Bible feature if data is missing
    verses = [];
    embeddings = new Float32Array(0);
  }
}

/**
 * Find the top K matching Bible verses for a given embedding.
 * Assumes both query and database embeddings are normalized,
 * so dot product == cosine similarity.
 */
export function getTopBibleVerses(queryEmbedding: number[], topK: number = 2): BibleVerse[] {
  if (!verses || !embeddings || verses.length === 0) {
    return [];
  }

  const scores: { index: number; score: number }[] = [];

  for (let i = 0; i < verses.length; i++) {
    let dotProduct = 0;
    const offset = i * EMBEDDING_DIM;
    
    for (let j = 0; j < EMBEDDING_DIM; j++) {
      dotProduct += queryEmbedding[j] * embeddings[offset + j];
    }
    
    scores.push({ index: i, score: dotProduct });
  }

  // Sort descending by score
  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, topK).map(s => verses![s.index]);
}
