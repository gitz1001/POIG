import { useState, useCallback, useRef } from 'react';
import { chatCompletion, extractMemory } from '../services/llm';
import { embedText } from '../services/embeddings';
import { getTopBibleVerses } from '../services/bible';
import { getRelevantMemories, getMoodContext, analyzeMoodTrend } from '../services/memory';
import { containsSelfHarm, SAFETY_RESPONSE, SAFETY_RESOURCES } from '../services/safety';
import { buildSystemPrompt } from '../services/systemPrompt';
import { addEntry } from '../db';
import type { ChatMessage, UserProfile, MascotState, Mood } from '../types';

export function useChat(profile: UserProfile | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mascotState, setMascotState] = useState<MascotState>('idle');
  const [isDeviceLost, setIsDeviceLost] = useState(false);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;
  
  const sendMessage = useCallback(async (text: string) => {
    if (!profile) return;
    if (!text.trim()) return;

    const userMsgId = Date.now().toString();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setMascotState('thinking');
    setIsDeviceLost(false);

    // 2. Safety Check (fast, local)
    if (containsSelfHarm(text)) {
      setMascotState('talking');
      const safetyMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'emoh',
        text: SAFETY_RESPONSE,
        timestamp: Date.now(),
        isSafetyResponse: true,
      };
      setMessages(prev => [...prev, safetyMsg]);
      
      setTimeout(() => setMascotState('idle'), 3000);
      return;
    }

    try {
      // 3. RAG Pipeline
      const [queryEmbedding, recentMoods] = await Promise.all([
        embedText(text),
        getMoodContext(5)
      ]);

      const [relevantMemories, bibleVerses] = await Promise.all([
        getRelevantMemories(queryEmbedding, 2), // top 2 memories
        Promise.resolve(getTopBibleVerses(queryEmbedding, 2))
      ]);

      const moodTrend = analyzeMoodTrend(recentMoods);

      let systemPrompt = buildSystemPrompt(
        profile,
        moodTrend,
        recentMoods,
        relevantMemories
      );

      // Append last 6 messages
      const historyMsg = messagesRef.current.slice(-6);
      if (historyMsg.length > 0) {
        const historyText = historyMsg.map(m => `${m.role === 'user' ? profile.name : 'Emoh'}: ${m.text}`).join('\n');
        systemPrompt += `\n\nRecent History:\n${historyText}`;
      }

      // 5. Generate Reply (Streaming)
      const emohMsgId = (Date.now() + 1).toString();
      
      setMessages(prev => [
        ...prev, 
        { id: emohMsgId, role: 'emoh', text: '', timestamp: Date.now() }
      ]);
      setMascotState('talking');

      const fullReply = await chatCompletion(systemPrompt, text, (chunk) => {
        setMessages(prev => 
          prev.map(m => m.id === emohMsgId ? { ...m, text: chunk } : m)
        );
      });

      if (bibleVerses.length > 0) {
        setMessages(prev => 
          prev.map(m => m.id === emohMsgId ? { ...m, bibleVerses } : m)
        );
      }
      
      setMascotState('idle');

      // 6. Memory Extraction
      extractMemory(text, fullReply).then(async (jsonStr) => {
        try {
          const extraction = JSON.parse(jsonStr) as { summary: string, mood: Mood, themes: string[] };
          
          await addEntry({
            timestamp: Date.now(),
            userText: text,
            emohReply: fullReply,
            summary: extraction.summary || 'No summary',
            mood: extraction.mood || 'neutral',
            themes: extraction.themes || [],
            embedding: queryEmbedding,
            feedbackScore: 0
          });
        } catch (e) {
          console.error("Failed to parse memory extraction", e);
        }
      });

    } catch (err: any) {
      console.error('Chat error:', err);
      setMascotState('idle');
      const errStr = String(err).toLowerCase();
      if (errStr.includes('device was lost') || errStr.includes('insufficient memory')) {
        setIsDeviceLost(true);
      }
    }

  }, [profile]);

  return { messages, mascotState, setMascotState, sendMessage, isDeviceLost, setIsDeviceLost };
}
