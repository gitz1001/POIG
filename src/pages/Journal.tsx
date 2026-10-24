import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllEntries, updateEntry, deleteEntry } from '../db';
import { embedText, isEmbeddingsReady } from '../services/embeddings';
import type { JournalEntry } from '../types';
import { BackIcon, EditIcon, TrashIcon, DownloadIcon } from '../components/Icons';

const DAY_MS = 24 * 60 * 60 * 1000;

// Simple Mood color mapper
const getMoodColor = (mood: string) => {
  switch (mood) {
    case 'happy': return '#ffc6e0';
    case 'sad': return '#bfe3ff';
    case 'anxious': return '#ffe2b8';
    case 'calm': return '#c9b8ff';
    case 'angry': return '#ffb0b0';
    default: return '#e9e4f7';
  }
};

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function dayLabel(dayStart: number): string {
  const today = startOfDay(Date.now());
  if (dayStart === today) return 'Today';
  if (dayStart === today - DAY_MS) return 'Yesterday';
  return new Date(dayStart).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** Consecutive days with at least one entry, ending today or yesterday. */
function computeStreak(entries: JournalEntry[]): number {
  const days = new Set(entries.map(e => startOfDay(e.timestamp)));
  let cursor = startOfDay(Date.now());
  if (!days.has(cursor)) cursor -= DAY_MS;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}

function toMarkdown(entries: JournalEntry[]): string {
  const lines = ['# My Emoh Journal', ''];
  [...entries].sort((a, b) => a.timestamp - b.timestamp).forEach(e => {
    lines.push(`## ${new Date(e.timestamp).toLocaleString()} · ${e.mood}`, '');
    lines.push(e.userText || '_(image only)_', '');
    if (e.emohReply) lines.push(`> **Emoh:** ${e.emohReply.replace(/\n/g, '\n> ')}`, '');
    if (e.themes.length) lines.push(e.themes.map(t => `#${t}`).join(' '), '');
  });
  return lines.join('\n');
}

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getAllEntries()
      .then(setEntries)
      .catch(err => console.error('Failed to load journal', err))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(e =>
      e.userText.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.mood.includes(q) ||
      e.themes.some(t => t.toLowerCase().includes(q.replace(/^#/, '')))
    );
  }, [entries, query]);

  // Group newest-first entries under day headers
  const groups = useMemo(() => {
    const map = new Map<number, JournalEntry[]>();
    filtered.forEach(e => {
      const key = startOfDay(e.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return [...map.entries()];
  }, [filtered]);

  const streak = useMemo(() => computeStreak(entries), [entries]);

  const startEdit = (entry: JournalEntry) => {
    setEditingId(entry.id!);
    setEditText(entry.userText);
    setExpandedId(entry.id!);
  };

  const saveEdit = async (entry: JournalEntry) => {
    const text = editText.trim();
    if (!text && !entry.image) return;
    const changes: Partial<JournalEntry> = { userText: text, editedAt: Date.now() };
    // Keep Emoh's memory of this entry in sync with the new wording
    if (text && isEmbeddingsReady()) {
      try { changes.embedding = await embedText(text); } catch { /* keep old embedding */ }
    }
    await updateEntry(entry.id!, changes);
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, ...changes } : e));
    setEditingId(null);
  };

  const handleDelete = async (entry: JournalEntry) => {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    await deleteEntry(entry.id!);
    setEntries(prev => prev.filter(e => e.id !== entry.id));
  };

  const handleExport = () => {
    const blob = new Blob([toMarkdown(entries)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emoh_journal_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const iconBtn: React.CSSProperties = {
    border: 0, background: 'rgba(255,255,255,0.45)', color: 'var(--ink)', borderRadius: '50%',
    width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };

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
            style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.4)', cursor: 'pointer', color: 'var(--ink)' }}
            onClick={() => navigate('/')}
            aria-label="Back"
          >
            <BackIcon size={24} />
          </button>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>My Journal</h2>
          <button
            className="glass"
            style={{ width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.4)', cursor: entries.length ? 'pointer' : 'default', color: 'var(--ink)', opacity: entries.length ? 1 : 0.4 }}
            onClick={handleExport}
            disabled={entries.length === 0}
            title="Download as text"
            aria-label="Download journal as text"
          >
            <DownloadIcon size={20} />
          </button>
        </header>

        {entries.length > 0 && (
          <>
            <div className="w-full flex gap-2 mb-4 text-sm">
              <div className="glass panel" style={{ padding: '12px', borderRadius: '20px', gap: '2px' }}>
                <strong style={{ fontSize: '20px' }}>{entries.length}</strong>
                <span className="opacity-70">{entries.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              <div className="glass panel" style={{ padding: '12px', borderRadius: '20px', gap: '2px' }}>
                <strong style={{ fontSize: '20px' }}>{streak}</strong>
                <span className="opacity-70">day streak</span>
              </div>
            </div>

            {/* Mood Timeline */}
            <div className="w-full glass panel mb-4 animate-slide-up" style={{ padding: '16px', borderRadius: '24px' }}>
              <h3 className="text-sm opacity-70 m-0 text-left">Recent Moods</h3>
              <div className="flex items-center gap-2 overflow-x-auto w-full pb-2" style={{ height: '48px' }}>
                {[...entries].reverse().slice(-15).map((e) => (
                  <div
                    key={e.id}
                    style={{
                      flex: '1',
                      borderRadius: '999px',
                      minWidth: '24px',
                      height: e.mood === 'happy' || e.mood === 'calm' ? '100%' : '60%',
                      backgroundColor: getMoodColor(e.mood),
                      transition: 'all 0.2s ease'
                    }}
                    title={`${e.mood} · ${new Date(e.timestamp).toLocaleDateString()}`}
                  ></div>
                ))}
              </div>
            </div>

            <input
              className="input-field mb-4"
              style={{ textAlign: 'left', borderRadius: '999px', padding: '12px 18px' }}
              placeholder="Search entries, moods or #themes"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search journal"
            />
          </>
        )}

        {/* Entry List */}
        <div className="w-full flex flex-col gap-4 text-left pb-4">
          {isLoading ? (
            <div className="text-center p-4 opacity-70">Opening your journal…</div>
          ) : entries.length === 0 ? (
            <div className="text-center p-4 glass panel opacity-70" style={{ borderRadius: '24px' }}>
              <p style={{ margin: 0 }}>Your journal is empty.</p>
              <p className="text-sm mt-2" style={{ margin: 0 }}>Write or dictate to Emoh and every entry will show up here.</p>
              <button className="btn btn-primary mt-2" onClick={() => navigate('/')}>Write your first entry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-4 opacity-70">No entries match "{query}".</div>
          ) : (
            groups.map(([day, dayEntries]) => (
              <section key={day} className="flex flex-col gap-2">
                <h3 className="text-sm m-0 opacity-70" style={{ fontWeight: 600, paddingLeft: '4px' }}>{dayLabel(day)}</h3>
                {dayEntries.map(entry => {
                  const isExpanded = expandedId === entry.id;
                  const isEditing = editingId === entry.id;
                  return (
                    <article key={entry.id} className="glass panel animate-slide-up" style={{ padding: '16px', gap: '8px', borderRadius: '24px', textAlign: 'left' }}>
                      <div className="flex justify-between items-center">
                        <span className="text-xs opacity-70 font-medium">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {entry.editedAt ? ' · edited' : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: getMoodColor(entry.mood), color: 'var(--ink)' }}>
                            {entry.mood}
                          </span>
                          <button style={iconBtn} onClick={() => startEdit(entry)} title="Edit" aria-label="Edit entry"><EditIcon size={15} /></button>
                          <button style={iconBtn} onClick={() => handleDelete(entry)} title="Delete" aria-label="Delete entry"><TrashIcon size={15} /></button>
                        </div>
                      </div>

                      {entry.image && (
                        <img src={entry.image} alt="Attached" style={{ maxWidth: '100%', maxHeight: isExpanded ? 'none' : '160px', objectFit: 'cover', borderRadius: '12px' }} />
                      )}

                      {isEditing ? (
                        <>
                          <textarea
                            className="input-field"
                            style={{ textAlign: 'left', minHeight: '120px', resize: 'vertical', borderRadius: '16px' }}
                            value={editText}
                            onChange={e => setEditText(e.target.value)}
                            autoFocus
                            aria-label="Edit entry text"
                          />
                          <div className="flex gap-2">
                            <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => setEditingId(null)}>Cancel</button>
                            <button className="btn btn-primary" style={{ padding: '8px' }} onClick={() => saveEdit(entry)} disabled={!editText.trim() && !entry.image}>Save</button>
                          </div>
                        </>
                      ) : entry.userText ? (
                        <p
                          className="text-sm m-0"
                          style={{
                            whiteSpace: 'pre-wrap', lineHeight: 1.5, cursor: 'pointer',
                            ...(isExpanded ? {} : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }),
                          }}
                          onClick={() => setExpandedId(isExpanded ? null : entry.id!)}
                        >
                          {entry.userText}
                        </p>
                      ) : null}

                      {isExpanded && !isEditing && entry.emohReply && (
                        <div className="text-sm" style={{ background: 'rgba(255,255,255,0.35)', borderRadius: '14px', padding: '10px 12px', whiteSpace: 'pre-wrap' }}>
                          <strong>Emoh:</strong> {entry.emohReply}
                        </div>
                      )}

                      {entry.themes.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {entry.themes.map(t => (
                            <button
                              key={t}
                              className="text-xs px-2 py-1 rounded"
                              style={{ background: 'rgba(255,255,255,0.4)', border: 0, color: 'var(--ink)', cursor: 'pointer', font: 'inherit', fontSize: '12px' }}
                              onClick={() => setQuery(`#${t}`)}
                            >
                              #{t}
                            </button>
                          ))}
                        </div>
                      )}

                      {!isEditing && (entry.emohReply || (entry.userText && entry.userText.length > 200)) && (
                        <button
                          className="text-xs opacity-70"
                          style={{ alignSelf: 'flex-start', border: 0, background: 'none', color: 'var(--ink)', cursor: 'pointer', padding: 0, font: 'inherit', fontSize: '12px' }}
                          onClick={() => setExpandedId(isExpanded ? null : entry.id!)}
                        >
                          {isExpanded ? 'Show less' : entry.emohReply ? "Read more & Emoh's reply" : 'Read more'}
                        </button>
                      )}
                    </article>
                  );
                })}
              </section>
            ))
          )}
        </div>
      </div>
    </>
  );
}
