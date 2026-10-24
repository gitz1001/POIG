/* ============================================================
   Voice Recorder Hook — MediaRecorder → Whisper STT
   ============================================================ */

import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudio, decodeToWhisperInput } from '../services/whisper';
import type { Language } from '../types';

// Long recordings get heavy for whisper-tiny on CPU; stop automatically
const MAX_RECORDING_SECONDS = 5 * 60;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find(t => MediaRecorder.isTypeSupported(t));
}

/** Turn getUserMedia failures into something a user can act on. */
function describeMicError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was blocked. Allow it in your browser settings to dictate.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone was found on this device.';
  }
  if (name === 'NotReadableError') {
    return 'Your microphone is being used by another app.';
  }
  return 'Could not start recording.';
}

interface VoiceRecorderOptions {
  language?: Language;
  /** Called with the transcript whenever a recording finishes (manual or auto-stop). */
  onTranscript: (text: string) => void;
}

export function useVoiceRecorder({ language, onTranscript }: VoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Release the mic if the page unmounts mid-recording
  useEffect(() => () => {
    cancelledRef.current = true;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    stopTracks();
  }, [stopTracks]);

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      const msg = 'Voice input needs a secure (https) connection and a modern browser.';
      setError(msg);
      throw new Error(msg);
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (err) {
      setError(describeMicError(err));
      throw err;
    }

    const mimeType = pickMimeType();
    const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = mediaRecorder;
    streamRef.current = stream;
    chunksRef.current = [];
    cancelledRef.current = false;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stopTracks();
      setIsRecording(false);
      if (cancelledRef.current) return;

      const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || mimeType || 'audio/webm' });
      if (blob.size === 0) return;

      setIsTranscribing(true);
      try {
        const audio = await decodeToWhisperInput(blob);
        const text = await transcribeAudio(audio, language);
        if (text) onTranscriptRef.current(text);
        else setError("I couldn't catch that. Try speaking a little closer to the mic.");
      } catch (err) {
        console.error('Transcription failed:', err);
        setError('Transcription failed. Please try again.');
      } finally {
        setIsTranscribing(false);
      }
    };

    // Timeslice so data is flushed regularly on long recordings
    mediaRecorder.start(1000);
    setElapsed(0);
    setIsRecording(true);

    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(secs);
      if (secs >= MAX_RECORDING_SECONDS && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 250);
  }, [language, stopTracks]);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      stopTracks();
    }
    setIsRecording(false);
    setError(null);
  }, [stopTracks]);

  return {
    isRecording,
    isTranscribing,
    elapsed,
    error,
    clearError: () => setError(null),
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
