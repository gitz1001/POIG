/* ============================================================
   Whisper STT Service — local speech-to-text via transformers.js
   ============================================================ */

import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { Language } from '../types';

// Match embeddings.ts: use Hugging Face Hub (remote download) then cache
env.allowLocalModels = false;

const MODEL_ID = 'Xenova/whisper-tiny';
const SAMPLE_RATE = 16000;

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let loadingPromise: Promise<void> | null = null;

/**
 * Initialize the Whisper model.
 * Concurrent callers share the same in-flight load instead of returning early.
 */
export async function initWhisper(
  onProgress?: (info: { file: string; progress: number; status: string }) => void
): Promise<void> {
  if (transcriber) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
      progress_callback: (x: any) => {
        if (onProgress && x.status === 'progress' && typeof x.progress === 'number') {
          onProgress({ file: x.file || 'model', progress: x.progress, status: x.status });
        }
      },
      device: 'wasm'
    });
  })();

  try {
    await loadingPromise;
  } finally {
    loadingPromise = null;
  }
}

export function isWhisperReady(): boolean {
  return transcriber !== null;
}

/**
 * Decode a recorded audio blob into 16kHz mono samples for Whisper.
 * Resampling through OfflineAudioContext works across Chrome, Safari and Firefox,
 * regardless of the mic's native sample rate or the container format.
 */
export async function decodeToWhisperInput(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    await ctx.close();
  }

  const length = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, length, SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded; // Multi-channel input is mixed down to mono
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

// Whisper names for languages we can pin; Taglish is left to auto-detect
const WHISPER_LANGUAGE: Partial<Record<Language, string>> = {
  english: 'english',
  tagalog: 'tagalog',
};

/**
 * Transcribe 16kHz mono audio using the local Whisper model.
 * Long recordings are processed in overlapping 30s windows so nothing past
 * the first 30 seconds gets dropped.
 */
export async function transcribeAudio(audio: Float32Array, language?: Language): Promise<string> {
  if (!transcriber) {
    throw new Error('Whisper model not initialized.');
  }

  const whisperLanguage = language ? WHISPER_LANGUAGE[language] : undefined;
  const result = await transcriber(audio, {
    chunk_length_s: 30,
    stride_length_s: 5,
    task: 'transcribe',
    ...(whisperLanguage ? { language: whisperLanguage } : {}),
  } as any);

  const text = Array.isArray(result)
    ? result.map(r => (r as { text: string }).text).join(' ')
    : (result as { text: string }).text;

  // Whisper emits markers like [BLANK_AUDIO] or (music) on silence/noise
  return text
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
