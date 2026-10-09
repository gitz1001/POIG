/* ============================================================
   Whisper STT Service — local speech-to-text via transformers.js
   ============================================================ */

import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/whisper-tiny';

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let isLoading = false;

/**
 * Initialize the Whisper model.
 */
export async function initWhisper(
  onProgress?: (info: { file: string; progress: number; status: string }) => void
): Promise<void> {
  if (transcriber || isLoading) return;
  isLoading = true;

  try {
    transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
      progress_callback: (x) => {
        if (onProgress && x.status === 'progress' && typeof x.progress === 'number') {
          onProgress({ file: x.file || 'model', progress: x.progress, status: x.status });
        }
      },
      device: 'wasm'
    });
  } catch (err) {
    isLoading = false;
    throw err;
  }

  isLoading = false;
}

export function isWhisperReady(): boolean {
  return transcriber !== null;
}

/**
 * Transcribe an AudioBuffer using the local Whisper model.
 */
export async function transcribeAudio(audioBuffer: AudioBuffer): Promise<string> {
  if (!transcriber) {
    throw new Error('Whisper model not initialized.');
  }

  // Transformers.js expects Float32Array audio data at 16000Hz
  // The frontend needs to ensure the AudioContext resamples it to 16kHz
  const audioData = audioBuffer.getChannelData(0);

  const result = await transcriber(audioData);
  
  // result can be an array of chunks or a single object depending on the return_timestamps flag.
  // By default, it returns a single object with a `text` property.
  return (result as { text: string }).text.trim();
}
