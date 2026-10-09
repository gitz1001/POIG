import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllEntries } from '../db';
import type { JournalEntry } from '../types';

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const data = await getAllEntries();
      setEntries(data);
    }
    load();
  }, []);

  // Simple Mood color mapper
  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'happy': return '#ffc6e0';
      case 'sad': return '#bfe3ff';
      case 'anxious': return '#ffd3e6';
      case 'calm': return '#c9b8ff';
      case 'angry': return '#ff9fc6';
      default: return '#e9e4f7';
    }
  };

  return (
    <>
      <div className="bg">
        <div className="blob a"></div>
        <div className="blob b"></div>
        <div className="blob c"></div>
      </div>
      
      <div className="app" style={{ justifyContent: 'flex-start' }}>
        <header className="w-full flex justify-between items-center mb-4">
          <button className="btn btn-secondary text-xs" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => navigate('/')}>
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: '20px' }}>My Journal</h2>
          <div style={{ width: '80px' }}></div>
        </header>

        {/* Mood Timeline */}
        {entries.length > 0 && (
          <div className="w-full glass panel mb-4 animate-slide-up" style={{ padding: '16px' }}>
            <h3 className="text-sm opacity-70 m-0 text-left">Recent Moods</h3>
            <div className="flex items-center gap-2 overflow-x-auto w-full pb-2" style={{ height: '48px' }}>
              {[...entries].reverse().slice(-15).map((e, i) => (
                <div 
                  key={i} 
                  style={{ 
                    flex: '1',
                    borderRadius: '999px',
                    minWidth: '24px',
                    height: e.mood === 'happy' || e.mood === 'calm' ? '100%' : '60%',
                    backgroundColor: getMoodColor(e.mood),
                    transition: 'all 0.2s ease'
                  }}
                  title={e.mood}
                ></div>
              ))}
            </div>
          </div>
        )}

        {/* Entry List */}
        <div className="w-full flex flex-col gap-4 text-left pb-4">
          {entries.length === 0 ? (
            <div className="text-center p-4 glass panel opacity-70">
              <p style={{ margin: 0 }}>Your journal is empty.</p>
              <p className="text-sm mt-2" style={{ margin: 0 }}>Chat with Emoh to create memories.</p>
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div key={entry.id} className="glass panel animate-slide-up" style={{ padding: '16px', animationDelay: `${(idx % 5) * 0.1}s`, gap: '8px' }}>
                <div className="flex justify-between items-start border-b pb-2" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                  <span className="text-xs opacity-70 font-medium">
                    {new Date(entry.timestamp).toLocaleDateString()} · {new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                  <span 
                    className="text-xs px-2 py-1 rounded" 
                    style={{ backgroundColor: getMoodColor(entry.mood), color: 'var(--ink)' }}
                  >
                    {entry.mood}
                  </span>
                </div>
                <p className="text-sm font-medium m-0">"{entry.summary}"</p>
                
                <div className="mt-2 pt-2 border-t flex flex-wrap gap-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  {entry.themes.map(t => (
                    <span key={t} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.4)', opacity: 0.8 }}>
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
