import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { useModelLoader } from '../hooks/useModelLoader';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { initLLM, unloadLLM } from '../services/llm';
import { isWhisperReady } from '../services/whisper';
import { saveProfile } from '../db';
import { updateFeedback } from '../db';
import { SAFETY_RESOURCES } from '../services/safety';
import type { UserProfile, ChatMessage } from '../types';
import { SettingsIcon, MicIcon, SendIcon, ThumbUpIcon, ThumbDownIcon } from '../components/Icons';

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
  const [inputText, setInputText] = useState('');
  const [rantMode, setRantMode] = useState(profile.rantMode);
  const [dailyPrompt, setDailyPrompt] = useState('');
  const navigate = useNavigate();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const { messages, mascotState, sendMessage, isDeviceLost, setIsDeviceLost } = useChat(profile);
  const { progress, isComplete, loadAll } = useModelLoader();
  const { isRecording, isTranscribing, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

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

  const handleSend = () => {
    if (!inputText.trim() || !isComplete || mascotState !== 'idle' || isDeviceLost) return;
    sendMessage(inputText);
    setInputText('');
  };

  const handleMicToggle = async () => {
    if (!isComplete || !isWhisperReady()) return;
    
    if (isRecording) {
      try {
        const text = await stopRecording();
        if (text.trim()) {
          setInputText(text);
        }
      } catch (err) {
        console.error('Voice recording failed:', err);
      }
    } else {
      try {
        await startRecording();
      } catch (err) {
        console.error('Mic access denied:', err);
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

  const handleFeedback = async (msg: ChatMessage, score: number) => {
    // Update in DB if the entry exists
    if (msg.id) {
      try {
        await updateFeedback(parseInt(msg.id), score);
      } catch (e) {
        // Entry may not exist yet (extracted async), that's ok
      }
    }
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
      
      <div className="app">
        <div className="topbar">
          <div className="glass pill"><span className="dot"></span>Offline · Local only</div>
          <button className="glass pill" onClick={() => navigate('/settings')}>
            <SettingsIcon size={18} />
          </button>
        </div>
        
        <div className="stage">
          {/* Mascot — smaller when chat is active */}
          <svg 
            className={`emoh ${mascotState !== 'idle' ? mascotState : ''}`} 
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
                <div key={msg.id} className={`chat-bubble ${msg.role === 'user' ? 'user' : 'emoh'}`}>
                  {msg.text || (msg.role === 'emoh' ? '...' : '')}
                  
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
                  {msg.role === 'emoh' && msg.text && !msg.isSafetyResponse && (
                    <div className="feedback-row">
                      <button 
                        className={`feedback-btn ${msg.feedbackScore === 1 ? 'active-up' : ''}`}
                        onClick={() => handleFeedback(msg, 1)}
                        title="Helpful"
                      >
                        <ThumbUpIcon size={14} />
                      </button>
                      <button 
                        className={`feedback-btn ${msg.feedbackScore === -1 ? 'active-down' : ''}`}
                        onClick={() => handleFeedback(msg, -1)}
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
        
        <div className="glass inputbar">
          <input 
            placeholder={isEngineLoading ? "Loading..." : isTranscribing ? "Transcribing..." : "Rant to me…"}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={mascotState !== 'idle' || isEngineLoading || isTranscribing}
          />
          <button 
            className={`mic ${isRecording ? 'listening' : ''}`} 
            disabled={isEngineLoading || !isWhisperReady() || isTranscribing}
            onClick={handleMicToggle}
            title={isRecording ? 'Stop recording' : 'Start voice input'}
          >
            <MicIcon size={20} />
          </button>
          <button className="send" onClick={handleSend} disabled={!inputText.trim() || mascotState !== 'idle' || isEngineLoading}>
            <SendIcon size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
