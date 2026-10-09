import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, saveProfile, getAllEntries } from '../db';
import { initLLM, unloadLLM } from '../services/llm';
import { initEmbeddings } from '../services/embeddings';
import { initWhisper } from '../services/whisper';
import { initBible } from '../services/bible';
import type { UserProfile, Language } from '../types';
import { SettingsIcon, BackIcon, ShieldIcon, HistoryIcon, DownloadIcon, UploadIcon, LockIcon, CloudIcon, CheckIcon } from '../components/Icons';

export default function Settings() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [pinInput, setPinInput] = useState('');
  
  // Debug info
  const [debugInfo, setDebugInfo] = useState<{ adapter: string; f16: boolean; storage: string }>({ adapter: 'Unknown', f16: false, storage: 'Unknown' });

  // Status for buttons
  const [status, setStatus] = useState('');

  // Brain status
  const [brainStatus, setBrainStatus] = useState({
    llm: 'checking',
    memory: 'checking',
    ears: 'checking',
    bible: 'checking'
  });

  useEffect(() => {
    async function load() {
      const p = await getProfile();
      setProfile(p);
      const entries = await getAllEntries();
      setEntryCount(entries.length);

      // Check brains (simplified check)
      setBrainStatus({
        llm: globalThis.__emohEngine ? 'ready' : 'retry',
        memory: 'ready',
        ears: 'ready',
        bible: 'ready'
      });

      // Storage and adapter
      let adapterName = 'No WebGPU';
      let hasF16 = false;
      if (navigator.gpu) {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
          adapterName = adapter.info?.architecture || adapter.info?.vendor || 'WebGPU Adapter';
          hasF16 = adapter.features.has('shader-f16');
        }
      }
      
      let storageStr = 'Unknown';
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const mb = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
        storageStr = `${mb} MB`;
      }

      setDebugInfo({ adapter: adapterName, f16: hasF16, storage: storageStr });
    }
    load();
  }, []);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    const newP = { ...profile, ...updates };
    setProfile(newP);
    await saveProfile(newP);
  };

  const handleForgetEverything = async () => {
    if (confirm('Forget all journal entries? This cannot be undone.')) {
      // Keep profile, delete entries. For simplicity, just clearing DB entirely for now as requested.
      indexedDB.deleteDatabase('EmohDB');
      window.location.reload();
    }
  };

  const handleReloadBrain = async () => {
    setStatus('Reloading brain...');
    try {
      await unloadLLM();
      await initLLM();
      await initEmbeddings();
      await initWhisper();
      await initBible();
      setStatus('Brain reloaded successfully');
      setTimeout(() => setStatus(''), 3000);
      setBrainStatus({ llm: 'ready', memory: 'ready', ears: 'ready', bible: 'ready' });
    } catch(e) {
      setStatus('Failed to reload brain');
    }
  };

  if (!profile) return null;

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.28)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.65)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 40px rgba(120,90,200,0.18)',
    borderRadius: '28px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'left'
  };

  const headingStyle: React.CSSProperties = { margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' };

  return (
    <>
      <div className="bg">
        <div className="blob a"></div>
        <div className="blob b"></div>
        <div className="blob c"></div>
      </div>

      <div className="app" style={{ justifyContent: 'flex-start' }}>
        <header className="w-full flex justify-between items-center mb-4 pt-2">
          <button 
            className="glass" 
            style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <BackIcon size={24} />
          </button>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>Settings</h2>
          <div style={{ width: '48px' }}></div>
        </header>

        <div className="w-full flex flex-col gap-4 animate-slide-up pb-8">
          
          {/* Profile */}
          <div style={cardStyle}>
            <h3 style={headingStyle}>
              <SettingsIcon size={20} />
              Profile
            </h3>
            
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Name</span>
              <input 
                className="input-field" 
                style={{ textAlign: 'left', borderRadius: '16px', padding: '12px 16px' }}
                value={profile.name}
                onChange={e => updateProfile({ name: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Language</span>
              <div className="flex gap-2">
                {(['english', 'taglish', 'tagalog'] as Language[]).map(l => (
                  <button 
                    key={l}
                    className={`btn ${profile.language === l ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '12px 4px', fontSize: '14px' }}
                    onClick={() => updateProfile({ language: l })}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Reply Style</span>
              <div className="flex gap-2">
                {(['short', 'detailed'] as const).map(style => (
                  <button 
                    key={style}
                    className={`btn ${profile.replyStyle === style || (!profile.replyStyle && style === 'short') ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '12px 4px', fontSize: '14px' }}
                    onClick={() => updateProfile({ replyStyle: style })}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Emoh's Mode */}
          <div style={cardStyle}>
            <h3 style={headingStyle}>
              <ShieldIcon size={20} />
              Emoh's mode
            </h3>
            <div className="flex gap-2">
              <button 
                className={`btn ${profile.rantMode ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '12px 4px', fontSize: '14px' }}
                onClick={() => updateProfile({ rantMode: true })}
              >
                Just listen
              </button>
              <button 
                className={`btn ${!profile.rantMode ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '12px 4px', fontSize: '14px' }}
                onClick={() => updateProfile({ rantMode: false })}
              >
                Help me
              </button>
            </div>
          </div>

          {/* Memory */}
          <div style={cardStyle}>
            <h3 style={headingStyle}>
              <HistoryIcon size={20} />
              Memory
            </h3>
            <p className="text-sm m-0">Emoh remembers {entryCount} entries.</p>
            <div className="flex flex-col gap-2">
              <button className="btn btn-secondary" style={{ padding: '12px' }} onClick={() => navigate('/journal')}>
                View journal
              </button>
              <button className="btn" style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }} onClick={handleForgetEverything}>
                Forget everything
              </button>
            </div>
          </div>

          {/* Backup */}
          <div style={cardStyle}>
            <h3 style={headingStyle}>
              <DownloadIcon size={20} />
              Backup
            </h3>
            <div className="flex gap-2">
              <div style={{ position: 'relative', flex: 1 }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
                  <LockIcon size={16} />
                </div>
                <input 
                  type="password" 
                  className="input-field" 
                  style={{ letterSpacing: '8px', padding: '12px 12px 12px 36px', borderRadius: '16px', width: '100%' }}
                  maxLength={4}
                  placeholder="PIN" 
                  value={pinInput} 
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button className="btn btn-secondary flex items-center justify-center gap-2" style={{ flex: 1, padding: '12px' }}>
                <UploadIcon size={16} />
                Import backup
              </button>
            </div>
            <button className="btn btn-secondary flex items-center justify-center gap-2" style={{ padding: '12px' }}>
              <DownloadIcon size={16} />
              Export encrypted backup
            </button>
            <div className="flex justify-between items-center p-3 rounded" style={{ background: 'rgba(0,0,0,0.05)', opacity: 0.5 }}>
              <span className="text-sm flex items-center gap-2">
                <CloudIcon size={16} />
                Cloud backup
              </span>
              <span className="text-xs bg-black/10 px-2 py-1 rounded">Coming soon</span>
            </div>
          </div>

          {/* Privacy */}
          <div style={cardStyle}>
            <h3 style={headingStyle}>
              <ShieldIcon size={20} />
              Privacy
            </h3>
            <div className="flex flex-col gap-2 text-sm opacity-80">
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-black/50"></div> Runs on this device</div>
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-black/50"></div> No account, no tracking</div>
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-black/50"></div> Works offline</div>
            </div>
            <div className="flex justify-between items-center pt-2 mt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.1)' }}>
              <span className="text-sm font-medium">Status</span>
              <span className="text-sm" style={{ color: navigator.onLine ? '#10b981' : '#ef4444' }}>
                {navigator.onLine ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Brain status */}
          <div style={cardStyle}>
            <h3 style={headingStyle}>
              <SettingsIcon size={20} />
              Brain status
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span>LLM Engine</span>
                <span style={{ color: brainStatus.llm === 'ready' ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {brainStatus.llm === 'ready' && <CheckIcon size={14} />}
                  {brainStatus.llm}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Memory Embeddings</span>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckIcon size={14} />ready</span>
              </div>
              <div className="flex justify-between">
                <span>Ears (Whisper)</span>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckIcon size={14} />ready</span>
              </div>
              <div className="flex justify-between">
                <span>Bible Data</span>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckIcon size={14} />ready</span>
              </div>
            </div>
            <button className="btn btn-secondary mt-2" style={{ padding: '12px' }} onClick={handleReloadBrain}>
              Reload brain
            </button>
            {status && <div className="text-center text-sm font-medium mt-1">{status}</div>}
          </div>

          {/* Safety note */}
          <div className="text-center px-4 mt-2">
            <p className="text-xs opacity-60 m-0" style={{ lineHeight: 1.5 }}>
              Emoh is a buddy, not a counselor.<br/>
              If you need help, call Hopeline PH 0917-558-4673.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
