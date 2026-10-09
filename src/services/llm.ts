/* ============================================================
   Web-LLM Service — local Qwen2.5-1.5B-Instruct
   All inference happens in the browser via WebGPU.
   ============================================================ */

import {
  CreateMLCEngine,
  type MLCEngine,
  type ChatCompletionMessageParam,
  type InitProgressReport,
} from '@mlc-ai/web-llm';

declare global {
  var __emohEngine: MLCEngine | null;
  var __emohEnginePromise: Promise<MLCEngine> | null;
}

globalThis.__emohEngine = globalThis.__emohEngine || null;
globalThis.__emohEnginePromise = globalThis.__emohEnginePromise || null;

export async function getModelId(): Promise<string> {
  let hasF16 = false;
  if (navigator.gpu) {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter && adapter.features.has('shader-f16')) {
      hasF16 = true;
    }
  }
  return hasF16 ? 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' : 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';
}

/**
 * Initialize the LLM engine.
 * The progress callback fires as model shards download.
 */
export async function initLLM(
  onProgress?: (report: InitProgressReport) => void
): Promise<void> {
  if (globalThis.__emohEngine) return;
  
  if (globalThis.__emohEnginePromise) {
    await globalThis.__emohEnginePromise;
    return;
  }

  globalThis.__emohEnginePromise = (async () => {
    try {
      const modelId = await getModelId();
      const engine = await CreateMLCEngine(modelId, {
        initProgressCallback: onProgress,
        chatOpts: {
          context_window_size: 2048
        }
      });
      globalThis.__emohEngine = engine;
      return engine;
    } finally {
      globalThis.__emohEnginePromise = null;
    }
  })();

  await globalThis.__emohEnginePromise;
}

export async function unloadLLM() {
  if (globalThis.__emohEngine) {
    try {
      globalThis.__emohEngine.unload();
    } catch(e) {}
    globalThis.__emohEngine = null;
  }
}

/**
 * Check if the LLM engine is ready.
 */
export function isLLMReady(): boolean {
  return globalThis.__emohEngine !== null;
}

/**
 * Send a chat completion request to the local LLM.
 * Returns the full response text.
 *
 * @param systemPrompt - The dynamically built system prompt
 * @param userMessage  - The user's current message
 * @param onChunk      - Optional callback for streaming tokens
 */
export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  onChunk?: (partialText: string) => void
): Promise<string> {
  if (!globalThis.__emohEngine) {
    throw new Error('LLM engine not initialized. Call initLLM() first.');
  }

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  // Use streaming for real-time display
  if (onChunk) {
    let fullText = '';
    const stream = await globalThis.__emohEngine.chat.completions.create({
      messages,
      stream: true,
      max_tokens: 200,
      temperature: 0.7,
      top_p: 0.9,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      fullText += delta;
      onChunk(fullText);
    }

    return fullText;
  }

  // Non-streaming fallback
  const response = await globalThis.__emohEngine.chat.completions.create({
    messages,
    max_tokens: 200,
    temperature: 0.7,
    top_p: 0.9,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate a structured memory extraction from the conversation.
 * Returns JSON with { summary, mood, themes }.
 */
export async function extractMemory(
  userText: string,
  emohReply: string
): Promise<string> {
  if (!globalThis.__emohEngine) {
    throw new Error('LLM engine not initialized.');
  }

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a journal analysis assistant. Given a user's message and a buddy's reply, extract structured data.
Respond with ONLY valid JSON in this exact format:
{"summary": "one sentence summary of what the user shared", "mood": "one of: happy, sad, anxious, calm, angry, neutral", "themes": ["theme1", "theme2"]}
Do not include any other text.`,
    },
    {
      role: 'user',
      content: `User said: "${userText}"\nBuddy replied: "${emohReply}"`,
    },
  ];

  const response = await globalThis.__emohEngine.chat.completions.create({
    messages,
    max_tokens: 150,
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content || '{}';
}
