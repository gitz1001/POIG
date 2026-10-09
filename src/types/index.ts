/* ============================================================
   Types for Emoh — shared across the entire app
   ============================================================ */

/** Possible mascot animation states */
export type MascotState = 'idle' | 'listening' | 'thinking' | 'talking';

/** Mood categories detected from user entries */
export type Mood = 'happy' | 'sad' | 'anxious' | 'calm' | 'angry' | 'neutral';

/** User's preferred language */
export type Language = 'english' | 'taglish' | 'tagalog';

/** A single journal entry stored in IndexedDB */
export interface JournalEntry {
  id?: number;              // Auto-incremented by Dexie
  timestamp: number;        // Unix ms
  userText: string;         // What the user typed/spoke
  emohReply: string;        // What Emoh replied
  summary: string;          // LLM-generated summary
  mood: Mood;               // LLM-detected mood
  themes: string[];         // LLM-extracted themes
  embedding: number[];      // 384-dim MiniLM embedding of userText
  feedbackScore: number;    // +1 thumbs up, -1 thumbs down, 0 = no feedback
}

/** Bible verse from /public/bible.json */
export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

/** User profile and preferences stored in IndexedDB */
export interface UserProfile {
  id?: number;               // Always 1 (singleton record)
  name: string;
  pinHash: string;           // SHA-256 hash of the 4-digit PIN
  pinSalt: string;           // Random salt for PIN hashing
  language: Language;
  replyStyle?: 'short' | 'detailed';
  rantMode: boolean;         // true = just listen; false = help me
  onboardingComplete: boolean;
  modelsDownloaded: boolean;
  cloudBackup: boolean;      // Always false (feature disabled / coming soon)
  likedPatterns: string[];   // Patterns extracted from thumbs-up replies
  dislikedPatterns: string[];// Patterns extracted from thumbs-down replies
  createdAt: number;
}

/** Chat message in the conversation UI */
export interface ChatMessage {
  id: string;
  role: 'user' | 'emoh';
  text: string;
  timestamp: number;
  feedbackScore?: number;
  bibleVerses?: BibleVerse[];
  isSafetyResponse?: boolean;
}

/** Model download progress */
export interface ModelProgress {
  modelName: string;
  progress: number;  // 0 to 100
  status: 'pending' | 'downloading' | 'ready' | 'error';
  error?: string;
}

/** Result of the memory extraction from the LLM */
export interface MemoryExtraction {
  summary: string;
  mood: Mood;
  themes: string[];
}
