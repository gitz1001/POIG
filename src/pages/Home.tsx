import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { useModelLoader } from '../hooks/useModelLoader';
import { initLLM, unloadLLM } from '../services/llm';
import { saveProfile } from '../db';
import type { UserProfile } from '../types';
import { SettingsIcon, MicIcon, SendIcon } from '../components/Icons';

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
  
  const { messages, mascotState, sendMessage, isDeviceLost, setIsDeviceLost } = useChat(profile);
  const { progress, isComplete, loadAll } = useModelLoader();

  useEffect(() => {
    if (!isComplete) {
      loadAll();
    }
  }, [isComplete, loadAll]);

  useEffect(() => {
    setDailyPrompt(JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)]);
  }, []);

  const handleSend = () => {
    if (!inputText.trim() || !isComplete || mascotState !== 'idle' || isDeviceLost) return;
    sendMessage(inputText);
    setInputText('');
  };

  const handleRestart = async () => {
    setIsDeviceLost(false);
    await unloadLLM();
    // Re-initialize LLM. The other models (wasm) are fine.
    await initLLM();
  };

  const toggleRantMode = async (mode: boolean) => {
    setRantMode(mode);
    await saveProfile({ ...profile, rantMode: mode });
  };

  const latestEmohMessage = [...messages].reverse().find(m => m.role === 'emoh');
  const llmProgress = progress.find(p => p.status === 'downloading') || progress[0];
  const isEngineLoading = !isComplete;

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
          <svg className="emoh" viewBox="0 0 200 200">
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
            ) : latestEmohMessage ? (
              latestEmohMessage.text
            ) : (
              `Hi ${profile.name}! I'm Emoh. ${dailyPrompt}`
            )}
          </div>
        </div>
        
        <div className="glass toggle">
          <button className={rantMode ? 'on' : ''} onClick={() => toggleRantMode(true)}>Just listen</button>
          <button className={!rantMode ? 'on' : ''} onClick={() => toggleRantMode(false)}>Help me</button>
        </div>
        
        <div className="glass inputbar">
          <input 
            placeholder={isEngineLoading ? "Loading..." : "Rant to me…"}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={mascotState !== 'idle' || isEngineLoading}
          />
          <button className={`mic ${mascotState !== 'idle' ? 'listening' : ''}`} disabled={isEngineLoading}>
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
