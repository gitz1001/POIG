/* ============================================================
   Embeddings Service — MiniLM-L6-v2 via transformers.js
   All-MiniLM-L6-v2 produces 384-dimensional embeddings.
   ============================================================ */

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

// Configure transformers.js to not use the default cache (use IndexedDB instead)
// and to only look for local/remote models according to library defaults.
env.allowLocalModels = false; // We use Hugging Face Hub (remote download) then cache it

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

let extractor: FeatureExtractionPipeline | null = null;
let isLoading = false;

/**
 * Initialize the embeddings model.
 * Downloads the ONNX model files and caches them via Service Worker / OPFS.
 */
export async function initEmbeddings(
  onProgress?: (info: { file: string; progress: number; status: string }) => void
): Promise<void> {
  if (extractor || isLoading) return;
  isLoading = true;

  try {
    // Pipeline for feature extraction (embeddings)
    extractor = await pipeline('feature-extraction', MODEL_ID, {
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

export function isEmbeddingsReady(): boolean {
  return extractor !== null;
}

/**
 * Generate a 384-dimensional embedding for a given text.
 * The output is a normalized Float32Array.
 */
export async function embedText(text: string): Promise<number[]> {
  if (!extractor) {
    throw new Error('Embeddings model not initialized.');
  }

  // Generate embeddings. `pooling: 'mean'` and `normalize: true` are typical for MiniLM.
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  
  // The output is a Tensor. We convert its data to a standard JS array.
  // Shape is [1, 384]
  return Array.from(output.data);
}
