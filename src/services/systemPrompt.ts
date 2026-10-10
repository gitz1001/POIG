/* ============================================================
   System Prompt Builder — dynamically constructs LLM context
   ============================================================ */

import type { UserProfile, JournalEntry } from '../types';

export function buildSystemPrompt(
  profile: UserProfile,
  moodTrend: 'improving' | 'declining' | 'stable',
  recentMoods: string[],
  relevantMemories: JournalEntry[]
): string {
  // Base persona
  let prompt = `You are Emoh, a warm, supportive digital journal and buddy. The user is writing in their personal diary, and you are here to listen, support, and reflect on their thoughts. The user's name is ${profile.name}.\n\n`;

  // Language preference
  if (profile.language === 'taglish') {
    prompt += `TONE RULES:\n- Keep replies short (2-3 sentences max).\n- Treat their messages as diary entries. Validate their reflections.\n- Use Taglish (a natural mix of conversational English and Filipino).\n- Be warm, empathetic, and never clinical.\n`;
  } else if (profile.language === 'tagalog') {
    prompt += `TONE RULES:\n- Keep replies short (2-3 sentences max).\n- Treat their messages as diary entries. Validate their reflections.\n- Use conversational Tagalog.\n- Be warm, empathetic, and never clinical.\n`;
  } else {
    prompt += `TONE RULES:\n- Keep replies short (2-3 sentences max).\n- Treat their messages as diary entries. Validate their reflections.\n- Use natural, conversational English.\n- Be warm, empathetic, and never clinical.\n`;
  }

  // Rant Mode
  if (profile.rantMode) {
    prompt += `\nMODE: RANT MODE IS ON.\nThe user just wants to vent. Listen, validate their feelings, and empathize. DO NOT give advice or try to fix their problems. Say things like "I hear you", "That sounds really hard", "I'm here for you."\n`;
  } else {
    prompt += `\nMODE: STANDARD.\nListen first, validate their feelings, then gently offer help or a positive perspective if appropriate.\n`;
  }

  // Mood Context
  if (recentMoods.length > 0) {
    prompt += `\nCURRENT MOOD CONTEXT:\n- Recent moods: ${recentMoods.join(' -> ')}\n- Mood trend: ${moodTrend}\n`;
    if (moodTrend === 'declining') {
      prompt += `- The user's mood seems to be declining. Be extra gentle and supportive.\n`;
    } else if (moodTrend === 'improving') {
      prompt += `- The user's mood seems to be improving. Gently celebrate their progress if appropriate.\n`;
    }
  }

  // Memories (RAG)
  if (relevantMemories.length > 0) {
    prompt += `\nRELEVANT PAST MEMORIES:\n`;
    relevantMemories.forEach((mem, i) => {
      prompt += `${i + 1}. The user previously talked about: "${mem.summary}" (Mood: ${mem.mood})\n`;
    });
    prompt += `Use these memories naturally if they relate to the current conversation, to show you remember them. Do not force them into the conversation.\n`;
  }

  // Feedback History
  if (profile.likedPatterns && profile.likedPatterns.length > 0) {
    prompt += `\nUSER PREFERENCES (from past feedback):\n- The user likes when you: ${profile.likedPatterns.join(', ')}\n`;
  }
  if (profile.dislikedPatterns && profile.dislikedPatterns.length > 0) {
    prompt += `- The user dislikes when you: ${profile.dislikedPatterns.join(', ')}. Avoid doing this.\n`;
  }

  return prompt;
}
