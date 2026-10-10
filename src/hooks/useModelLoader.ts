import { useState, useCallback } from 'react';
import { initLLM } from '../services/llm';
import { initEmbeddings } from '../services/embeddings';
import { initWhisper } from '../services/whisper';
import { initBible } from '../services/bible';
import type { ModelProgress } from '../types';

export function useModelLoader() {
  const [progress, setProgress] = useState<ModelProgress[]>([
    { modelName: 'Qwen2.5-0.5B (Brain)', progress: 0, status: 'pending' },
    { modelName: 'MiniLM (Memory)', progress: 0, status: 'pending' },
    { modelName: 'Whisper-tiny (Ears)', progress: 0, status: 'pending' },
    { modelName: 'Bible Data', progress: 0, status: 'pending' },
  ]);
  const [isComplete, setIsComplete] = useState(false);

  const updateProgress = (index: number, newProgress: number, status: ModelProgress['status'] = 'downloading') => {
    setProgress(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], progress: newProgress, status };
      return copy;
    });
  };

  const loadAll = useCallback(async () => {
    try {
      // Load Embeddings
      updateProgress(1, 0, 'downloading');
      await initEmbeddings((info) => {
        updateProgress(1, Math.round(info.progress), 'downloading');
      });
      updateProgress(1, 100, 'ready');

      // Load Whisper
      updateProgress(2, 0, 'downloading');
      await initWhisper((info) => {
        updateProgress(2, Math.round(info.progress), 'downloading');
      });
      updateProgress(2, 100, 'ready');

      // Load Bible
      updateProgress(3, 50, 'downloading');
      await initBible();
      updateProgress(3, 100, 'ready');

      // Load LLM (Last)
      updateProgress(0, 0, 'downloading');
      await initLLM((report) => {
        const match = report.text.match(/\[(\d+)\/(\d+)\]/);
        let pct = 50; 
        if (match) {
          pct = Math.round((parseInt(match[1]) / parseInt(match[2])) * 100);
        } else if (report.text.includes('Fetching')) {
           pct = 10;
        } else if (report.text.includes('Loading')) {
           pct = 80;
        }
        updateProgress(0, pct, 'downloading');
      });
      updateProgress(0, 100, 'ready');

      setIsComplete(true);
    } catch (err: any) {
      console.error('Model load failed', err);
      setProgress(prev => prev.map(p => 
        p.status === 'downloading' ? { ...p, status: 'error', error: err.message || String(err) } : p
      ));
    }
  }, []);

  return { progress, isComplete, loadAll };
}
