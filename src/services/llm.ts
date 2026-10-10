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
  var __useCloudFallback: boolean;
}

globalThis.__emohEngine = globalThis.__emohEngine || null;
globalThis.__emohEnginePromise = globalThis.__emohEnginePromise || null;
globalThis.__useCloudFallback = globalThis.__useCloudFallback || false;

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
        initProgressCallback: onProgress
      }, {
        context_window_size: 2048
      });
      globalThis.__emohEngine = engine;
      return engine;
    } catch (err) {
      console.warn('WebGPU not available. Falling back to Free Cloud LLM.', err);
      globalThis.__useCloudFallback = true;
      if (onProgress) {
        onProgress({ text: 'Using Cloud Fallback', progress: 1, timeElapsed: 0 });
      }
      return null as any;
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
  return globalThis.__emohEngine !== null || globalThis.__useCloudFallback;
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
  if (globalThis.__useCloudFallback) {
    return freeChatCompletion(systemPrompt, userMessage, onChunk);
  }

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
  if (globalThis.__useCloudFallback) {
    return freeExtractMemory(userText, emohReply);
  }

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

/* ============================================================
   Cloud Fallback Methods (Free Sample API)
   ============================================================ */

async function freeChatCompletion(
  systemPrompt: string,
  userMessage: string,
  onChunk?: (partialText: string) => void
): Promise<string> {
  const url = `https://text.pollinations.ai/openai/v1/chat/completions`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: !!onChunk,
      model: 'openai'
    })
  });

  if (!response.ok) throw new Error('Free API error: ' + response.statusText);

  if (!onChunk) {
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';

  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            const delta = data.choices?.[0]?.delta?.content || '';
            fullText += delta;
            onChunk(fullText);
          } catch (e) {}
        }
      }
    }
  }

  return fullText;
}

async function freeExtractMemory(userText: string, emohReply: string): Promise<string> {
  const url = `https://text.pollinations.ai/openai/v1/chat/completions`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: "You are a journal analysis assistant. Given a user's message and a buddy's reply, extract structured data. Respond with ONLY valid JSON in this exact format: {\"summary\": \"one sentence summary of what the user shared\", \"mood\": \"one of: happy, sad, anxious, calm, angry, neutral\", \"themes\": [\"theme1\", \"theme2\"]} Do not include any other text or markdown blocks." },
        { role: 'user', content: `User said: "${userText}"\nBuddy replied: "${emohReply}"` }
      ],
      stream: false,
      model: 'openai',
      response_format: { type: "json_object" }
    })
  });
  
  const data = await response.json();
  let text = data.choices?.[0]?.message?.content || '{}';
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return text;
}
