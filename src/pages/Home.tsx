import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { useModelLoader } from '../hooks/useModelLoader';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { initLLM, unloadLLM } from '../services/llm';
import { isWhisperReady } from '../services/whisper';
import { saveProfile } from '../db';
import { SAFETY_RESOURCES } from '../services/safety';
import type { UserProfile } from '../types';
import { SettingsIcon, MicIcon, SendIcon, ThumbUpIcon, ThumbDownIcon, ImageIcon, BookIcon, XIcon } from '../components/Icons';

const DRAFT_KEY = 'emoh-draft';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function readDraft(): string {
  try { return localStorage.getItem(DRAFT_KEY) || ''; } catch { return ''; }
}

function writeDraft(text: string) {
  try {
    if (text) localStorage.setItem(DRAFT_KEY, text);
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* storage unavailable — drafts are a convenience only */ }
}

const formatElapsed = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

interface HomeProps {
  profile: UserProfile;
}

const JOURNAL_PROMPTS = [
  "What's on your mind?",
  "What's something small that made you smile today?",
  "How is your heart feeling today?",
  "What's a thought you can't seem to shake off right now?",
  "Did anything surprise you today?",
  "What are you looking forward to tomorrow?",
  "Write about a moment today when you felt at peace."
];

export default function Home({ profile }: HomeProps) {
  const [inputText, setInputText] = useState(readDraft);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rantMode, setRantMode] = useState(profile.rantMode);
  const [dailyPrompt, setDailyPrompt] = useState('');
  const navigate = useNavigate();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { messages, mascotState, sendMessage, rateMessage, isDeviceLost, setIsDeviceLost } = useChat(profile);
  const { progress, isComplete, loadAll } = useModelLoader();

  // Dictation appends to whatever is already written, like a real dictation key
  const appendTranscript = (text: string) => {
    setInputText(prev => (prev.trim() ? `${prev.replace(/\s+$/, '')} ${text}` : text));
    textareaRef.current?.focus();
  };
  const {
    isRecording, isTranscribing, elapsed, error: voiceError, clearError,
    startRecording, stopRecording, cancelRecording,
  } = useVoiceRecorder({ language: profile.language, onTranscript: appendTranscript });

  useEffect(() => {
    if (!isComplete) {
      loadAll();
    }
  }, [isComplete, loadAll]);

  useEffect(() => {
    setDailyPrompt(JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)]);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Keep an unsent entry if the tab closes or the user navigates away
  useEffect(() => { writeDraft(inputText); }, [inputText]);

  // Grow the textarea with its content, up to the CSS max-height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [inputText]);

  const isBusy = mascotState !== 'idle';
  const whisperReady = progress[2]?.status === 'ready' || isWhisperReady();
  const canSend = (inputText.trim() !== '' || selectedImage !== null) && !isBusy && !isRecording && !isTranscribing;

  const handleSend = () => {
    if (!canSend) return;
    sendMessage(inputText, selectedImage || undefined);
    setInputText('');
    setSelectedImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on desktop; on touch keyboards Enter makes a new paragraph
    const isTouch = window.matchMedia?.('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !isTouch && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      alert('That image is too large (max 8 MB).');
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  };

  const handleMicToggle = async () => {
    if (!whisperReady || isTranscribing) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      try {
        await startRecording();
      } catch (err) {
        console.error('Mic access failed:', err);
      }
    }
  };

  const handleRestart = async () => {
    setIsDeviceLost(false);
    await unloadLLM();
    await initLLM();
  };

  const toggleRantMode = async (mode: boolean) => {
    setRantMode(mode);
    await saveProfile({ ...profile, rantMode: mode });
  };

  const llmProgress = progress.find(p => p.status === 'downloading') || progress[0];
  const isEngineLoading = !isComplete;
  const hasMessages = messages.length > 0;

  return (
    <>
      <div className="bg">
        <div className="blob a"></div>
        <div className="blob b"></div>
        <div className="blob c"></div>
      </div>
      
      <div className="app" style={{ overflow: 'hidden' }}>
        <div className="topbar">
          <div className="glass pill"><span className="dot"></span>Offline · Local only</div>
          <div className="flex gap-2">
            <button className="glass pill" onClick={() => navigate('/journal')} title="My journal" aria-label="My journal">
              <BookIcon size={18} />
            </button>
            <button className="glass pill" onClick={() => navigate('/settings')} title="Settings" aria-label="Settings">
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
        
        <div className="stage" style={{ minHeight: 0 }}>
          {/* Mascot — smaller when chat is active */}
          <svg 
            className={`emoh ${isRecording ? 'listening' : mascotState !== 'idle' ? mascotState : ''}`} 
            viewBox="0 0 200 200"
            style={hasMessages ? { width: 'min(35vw, 140px)' } : undefined}
          >
            <defs>
              <radialGradient id="body" cx="40%" cy="30%" r="80%">
                <stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#e9e4f7"/>
              </radialGradient>
            </defs>
            <ellipse cx="55" cy="75" rx="22" ry="48" fill="url(#body)" transform="rotate(-18 55 75)"/>
            <ellipse cx="145" cy="75" rx="22" ry="48" fill="url(#body)" transform="rotate(18 145 75)"/>
            <ellipse cx="55" cy="80" rx="10" ry="30" fill="#ffd3e6" opacity=".7" transform="rotate(-18 55 80)"/>
            <ellipse cx="145" cy="80" rx="10" ry="30" fill="#ffd3e6" opacity=".7" transform="rotate(18 145 80)"/>
            <ellipse cx="100" cy="120" rx="68" ry="62" fill="url(#body)"/>
            <ellipse cx="78" cy="88" rx="26" ry="12" fill="#fff" opacity=".8"/>
            <ellipse className="eye" cx="76" cy="118" rx="9" ry="12" fill="#2a1f4a"/>
            <ellipse className="eye" cx="124" cy="118" rx="9" ry="12" fill="#2a1f4a"/>
            <circle cx="79" cy="113" r="3.5" fill="#fff"/><circle cx="127" cy="113" r="3.5" fill="#fff"/>
            <ellipse cx="58" cy="140" rx="11" ry="7" fill="#ff9fc6" opacity=".6"/>
            <ellipse cx="142" cy="140" rx="11" ry="7" fill="#ff9fc6" opacity=".6"/>
            <path d="M90 142 Q100 152 110 142" stroke="#2a1f4a" strokeWidth="3" fill="none" strokeLinecap="round"/>
          </svg>
          
          {/* Status area — only when no messages */}
          {!hasMessages && (
            <div className="reply">
              {isDeviceLost ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#ff4444' }}>Emoh's brain needs a restart</span>
                  <button 
                    onClick={handleRestart}
                    style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '99px', border: '1px solid #ff4444', background: 'rgba(255,68,68,0.1)', color: '#ff4444', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Restart Emoh
                  </button>
                </div>
              ) : isEngineLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ opacity: 0.7 }}>Emoh's brain is still loading...</span>
                  <span style={{ fontSize: '14px', opacity: 0.6, marginTop: '4px' }}>You can already write. Entries are saved right away.</span>
                  <span style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px', fontFamily: 'monospace' }}>
                    {llmProgress?.status === 'downloading' 
                      ? `Downloading ${llmProgress.modelName} ${llmProgress.progress}%` 
                      : 'Starting engines...'}
                  </span>
                  {llmProgress?.error && (
                    <span style={{ fontSize: '12px', color: '#ff4444', marginTop: '4px' }}>
                      {llmProgress.error}
                    </span>
                  )}
                </div>
              ) : (
                `Hi ${profile.name}! I'm Emoh. ${dailyPrompt}`
              )}
            </div>
          )}

          {/* Chat history — scrollable */}
          {hasMessages && (
            <div className="chat-container" ref={chatContainerRef}>
              {/* Device lost banner */}
              {isDeviceLost && (
                <div style={{ textAlign: 'center', padding: '12px' }}>
                  <span style={{ color: '#ff4444', fontSize: '14px' }}>Emoh's brain needs a restart</span>
                  <button 
                    onClick={handleRestart}
                    style={{ marginTop: '8px', padding: '6px 14px', borderRadius: '99px', border: '1px solid #ff4444', background: 'rgba(255,68,68,0.1)', color: '#ff4444', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', display: 'block', margin: '8px auto 0' }}
                  >
                    Restart
                  </button>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`chat-bubble ${msg.role === 'user' ? 'user' : 'emoh'}${msg.isNotice ? ' notice' : ''}`}>
                  {msg.image && (
                    <img 
                      src={msg.image} 
                      alt="Attached" 
                      style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: msg.text ? '8px' : 0 }} 
                    />
                  )}
                  {msg.text || (msg.role === 'emoh' ? '...' : '')}

                  {msg.role === 'user' && (
                    <div className="bubble-meta">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.entryId !== undefined && ' · saved'}
                    </div>
                  )}
                  
                  {/* Bible verses — Task 2.2 */}
                  {msg.bibleVerses && msg.bibleVerses.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                      {msg.bibleVerses.map((v, i) => (
                        <div key={i} className="bible-card">
                          <div>📖 {v.text}</div>
                          <div className="bible-ref">— {v.book} {v.chapter}:{v.verse}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Safety resources — Task 2.3 */}
                  {msg.isSafetyResponse && (
                    <div className="safety-card">
                      {SAFETY_RESOURCES.map((r, i) => (
                        <a 
                          key={i} 
                          href={`tel:${r.contact.split(' or ')[0].replace(/-/g, '')}`}
                          className="safety-resource"
                        >
                          <span className="resource-name">{r.name}</span>
                          <span className="resource-contact">{r.contact}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Feedback buttons — Task 2.4 */}
                  {msg.role === 'emoh' && msg.text && !msg.isSafetyResponse && !msg.isNotice && mascotState !== 'talking' && (
                    <div className="feedback-row">
                      <button 
                        className={`feedback-btn ${msg.feedbackScore === 1 ? 'active-up' : ''}`}
                        onClick={() => rateMessage(msg.id, 1)}
                        title="Helpful"
                      >
                        <ThumbUpIcon size={14} />
                      </button>
                      <button 
                        className={`feedback-btn ${msg.feedbackScore === -1 ? 'active-down' : ''}`}
                        onClick={() => rateMessage(msg.id, -1)}
                        title="Not helpful"
                      >
                        <ThumbDownIcon size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="glass toggle">
          <button className={rantMode ? 'on' : ''} onClick={() => toggleRantMode(true)}>Just listen</button>
          <button className={!rantMode ? 'on' : ''} onClick={() => toggleRantMode(false)}>Help me</button>
        </div>
        
        {(isRecording || isTranscribing || voiceError) && (
          <div className="voice-status" role="status">
            {isRecording && (
              <>
                <span className="rec-dot" />
                <span>Listening… {formatElapsed(elapsed)}</span>
                <button className="voice-cancel" onClick={cancelRecording} title="Discard recording" aria-label="Discard recording">
                  <XIcon size={14} />
                </button>
              </>
            )}
            {isTranscribing && <span>Turning your voice into text…</span>}
            {!isRecording && !isTranscribing && voiceError && (
              <>
                <span>{voiceError}</span>
                <button className="voice-cancel" onClick={clearError} aria-label="Dismiss">
                  <XIcon size={14} />
                </button>
              </>
            )}
          </div>
        )}

        <div className="glass inputbar" style={{ flexWrap: 'wrap' }}>
          {selectedImage && (
            <div style={{ width: '100%', padding: '0 8px 8px', position: 'relative' }}>
              <img 
                src={selectedImage} 
                alt="Preview" 
                style={{ height: '60px', borderRadius: '8px', objectFit: 'cover' }} 
              />
              <button 
                onClick={() => setSelectedImage(null)}
                aria-label="Remove image"
                style={{ position: 'absolute', top: '-4px', left: '60px', background: '#ff4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>
          )}
          <textarea 
            ref={textareaRef}
            rows={1}
            placeholder={isTranscribing ? "Transcribing..." : isRecording ? "Listening..." : "Write or dictate what's on your mind…"}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTranscribing}
            aria-label="Journal entry"
          />
          
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          
          <button 
            className="mic" 
            disabled={isBusy || isRecording || isTranscribing}
            onClick={() => fileInputRef.current?.click()}
            title="Attach Image"
            aria-label="Attach image"
          >
            <ImageIcon size={20} />
          </button>

          <button 
            className={`mic ${isRecording ? 'listening' : ''}`} 
            disabled={!whisperReady || isTranscribing}
            onClick={handleMicToggle}
            title={!whisperReady ? 'Voice model is still loading' : isRecording ? 'Stop and transcribe' : 'Dictate'}
            aria-label={isRecording ? 'Stop and transcribe' : 'Dictate'}
            aria-pressed={isRecording}
          >
            <MicIcon size={20} />
          </button>
          <button className="send" onClick={handleSend} disabled={!canSend} title="Save entry" aria-label="Save entry">
            <SendIcon size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
