import { useState, useCallback, useRef, useEffect } from 'react';
import { chatCompletion, extractMemory, isLLMReady } from '../services/llm';
import { embedText, isEmbeddingsReady } from '../services/embeddings';
import { getTopBibleVerses } from '../services/bible';
import { getRelevantMemories, getMoodContext, analyzeMoodTrend } from '../services/memory';
import { containsSelfHarm, SAFETY_RESPONSE } from '../services/safety';
import { buildSystemPrompt } from '../services/systemPrompt';
import { addEntry, updateEntry, updateFeedback, getEntriesSince } from '../db';
import type { ChatMessage, UserProfile, MascotState, Mood, MemoryExtraction, JournalEntry } from '../types';

const MOODS: Mood[] = ['happy', 'sad', 'anxious', 'calm', 'angry', 'neutral'];

let idCounter = 0;
const newId = () => `${Date.now()}-${idCounter++}`;

/** Short fallback summary used until (or if) the LLM produces one. */
function previewOf(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return 'Shared an image';
  return clean.length > 140 ? `${clean.slice(0, 137)}…` : clean;
}

/** Small models often wrap JSON in prose or invent moods; accept only what we can use. */
function parseExtraction(raw: string): MemoryExtraction | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    const mood = typeof obj.mood === 'string' ? obj.mood.toLowerCase().trim() : '';
    return {
      summary: typeof obj.summary === 'string' ? obj.summary.trim() : '',
      mood: MOODS.includes(mood as Mood) ? (mood as Mood) : 'neutral',
      themes: Array.isArray(obj.themes)
        ? obj.themes.filter((t: unknown): t is string => typeof t === 'string' && t.trim() !== '')
            .map((t: string) => t.trim().toLowerCase())
            .slice(0, 5)
        : [],
    };
  } catch {
    return null;
  }
}

function entryToMessages(entry: JournalEntry): ChatMessage[] {
  const msgs: ChatMessage[] = [{
    id: `u-${entry.id}`,
    role: 'user',
    text: entry.userText,
    timestamp: entry.timestamp,
    image: entry.image,
    entryId: entry.id,
  }];
  if (entry.emohReply) {
    msgs.push({
      id: `e-${entry.id}`,
      role: 'emoh',
      text: entry.emohReply,
      timestamp: entry.timestamp,
      feedbackScore: entry.feedbackScore,
      entryId: entry.id,
      isSafetyResponse: entry.emohReply === SAFETY_RESPONSE,
    });
  }
  return msgs;
}

export function useChat(profile: UserProfile | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [isDeviceLost, setIsDeviceLost] = useState(false);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Restore today's entries so a reload doesn't wipe the conversation
  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    getEntriesSince(startOfDay.getTime()).then(entries => {
      const restored = entries.flatMap(entryToMessages);
      setMessages(prev => [
        ...restored.filter(r => !prev.some(p => p.entryId === r.entryId)),
        ...prev,
      ]);
    }).catch(err => console.error('Failed to restore today\'s entries', err));
  }, []);

  const patchMessage = (id: string, changes: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...changes } : m));
  };

  const sendMessage = useCallback(async (text: string, image?: string) => {
    if (!profile) return;
    if (!text.trim() && !image) return;

    const history = messagesRef.current.filter(m => !m.isNotice).slice(-6);
    const userMsgId = newId();
    const timestamp = Date.now();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text, timestamp, image }]);
    setMascotState('thinking');
    setIsDeviceLost(false);

    const isSafety = containsSelfHarm(text);
    const aiReady = isLLMReady() && isEmbeddingsReady();

    // Mood context must be read before this entry lands, or it counts itself
    const recentMoods = aiReady && !isSafety ? await getMoodContext(5).catch(() => []) : [];

    // 1. Save first — the journal entry must never depend on the AI succeeding
    let entryId: number;
    try {
      entryId = await addEntry({
        timestamp,
        userText: text,
        emohReply: isSafety ? SAFETY_RESPONSE : '',
        summary: previewOf(text),
        mood: 'neutral',
        themes: [],
        embedding: [],
        feedbackScore: 0,
        image,
      });
      patchMessage(userMsgId, { entryId });
    } catch (err) {
      console.error('Failed to save entry', err);
      setMessages(prev => [...prev, {
        id: newId(), role: 'emoh', isNotice: true, timestamp: Date.now(),
        text: "I couldn't save that entry. Your device storage may be full.",
      }]);
      setMascotState('idle');
      return;
    }

    // 2. Safety Check (fast, local) — bypasses the AI entirely
    if (isSafety) {
      setMascotState('talking');
      setMessages(prev => [...prev, {
        id: newId(),
        role: 'emoh',
        text: SAFETY_RESPONSE,
        timestamp: Date.now(),
        isSafetyResponse: true,
        entryId,
      }]);
      setTimeout(() => setMascotState('idle'), 3000);
      return;
    }

    // Writing works before the models finish downloading; replies come later
    if (!aiReady) {
      setMessages(prev => [...prev, {
        id: newId(), role: 'emoh', isNotice: true, timestamp: Date.now(),
        text: "Saved to your journal. I'll be able to reply once my brain finishes loading.",
      }]);
      setMascotState('idle');
      return;
    }

    const emohMsgId = newId();
    try {
      // 3. RAG Pipeline
      const queryText = text.trim() || "[User shared an image]";
      const queryEmbedding = await embedText(queryText);

      // Conditionally fetch Bible verses (10% chance or if requested)
      const lower = text.toLowerCase();
      const shouldFetchBible = Math.random() < 0.1 || lower.includes('bible') || lower.includes('verse');

      const relevantMemories = await getRelevantMemories(queryEmbedding, 2); // top 2 memories
      const bibleVerses = shouldFetchBible ? getTopBibleVerses(queryEmbedding, 2) : [];

      // Store the embedding now so this entry is searchable even if generation fails
      updateEntry(entryId, { embedding: queryEmbedding }).catch(console.error);

      const moodTrend = analyzeMoodTrend(recentMoods);
      let systemPrompt = buildSystemPrompt(profile, moodTrend, recentMoods, relevantMemories);

      if (history.length > 0) {
        const historyText = history.map(m => `${m.role === 'user' ? profile.name : 'Emoh'}: ${m.text}`).join('\n');
        systemPrompt += `\n\nRecent History:\n${historyText}`;
      }

      // 4. Generate Reply (Streaming)
      setMessages(prev => [...prev, { id: emohMsgId, role: 'emoh', text: '', timestamp: Date.now(), entryId }]);
      setMascotState('talking');

      const fullReply = (await chatCompletion(systemPrompt, queryText, (chunk) => {
        patchMessage(emohMsgId, { text: chunk });
      })).trim();

      patchMessage(emohMsgId, {
        text: fullReply,
        ...(bibleVerses.length > 0 ? { bibleVerses } : {}),
      });
      setMascotState('idle');
      updateEntry(entryId, { emohReply: fullReply }).catch(console.error);

      // 5. Memory Extraction — enriches the saved entry; failure keeps the preview summary
      extractMemory(queryText, fullReply).then(async (raw) => {
        const extraction = parseExtraction(raw);
        if (!extraction) return;
        await updateEntry(entryId, {
          ...(extraction.summary ? { summary: extraction.summary } : {}),
          mood: extraction.mood,
          themes: extraction.themes,
        });
      }).catch(err => console.error('Memory extraction failed', err));

    } catch (err: any) {
      console.error('Chat error:', err);
      setMascotState('idle');
      const errStr = String(err).toLowerCase();
      if (errStr.includes('device was lost') || errStr.includes('insufficient memory')) {
        setIsDeviceLost(true);
      }
      // Replace the empty streaming bubble (if any) with an honest status
      setMessages(prev => [
        ...prev.filter(m => m.id !== emohMsgId),
        {
          id: newId(), role: 'emoh', isNotice: true, timestamp: Date.now(),
          text: "I couldn't reply this time, but your entry is saved in your journal.",
        },
      ]);
    }

  }, [profile]);

  /** Thumbs up/down; tapping the active rating again clears it. */
  const rateMessage = useCallback(async (msgId: string, score: number) => {
    const msg = messagesRef.current.find(m => m.id === msgId);
    if (!msg) return;
    const next = msg.feedbackScore === score ? 0 : score;
    patchMessage(msgId, { feedbackScore: next });
    if (msg.entryId !== undefined) {
      await updateFeedback(msg.entryId, next).catch(console.error);
    }
  }, []);

  return { messages, mascotState, setMascotState, sendMessage, rateMessage, isDeviceLost, setIsDeviceLost };
}
