import { getState } from '../lib/store.js';
import { limitsFor, openUpgrade, setProForTesting } from '../lib/license.js';

const $ = (id) => document.getElementById(id);
const DAY = 86_400_000;

async function render() {
  const limits = await limitsFor();
  const { moods } = await getState(['moods']);
  const since = limits.moodHistoryDays === Infinity ? 0 : Date.now() - limits.moodHistoryDays * DAY;
  const visible = moods.filter((m) => m.at >= since);

  $('plan').hidden = !limits.pro;
  $('dev-pro').checked = limits.pro;
  $('export').textContent = limits.pro ? 'Export CSV' : 'Export CSV 🔒 Pro';

  const avg = visible.length ? visible.reduce((s, m) => s + m.score, 0) / visible.length : 0;
  $('summary').textContent = visible.length
    ? `${visible.length} check-ins, average ${avg.toFixed(1)}/5` +
      (limits.pro ? '' : ` · last ${limits.moodHistoryDays} days (Pro shows all-time)`)
    : 'No check-ins yet. Tap a face in the popup to log your mood.';

  // One bar per day, height = that day's average score.
  const byDay = new Map();
  for (const m of visible) {
    const day = new Date(m.at).toDateString();
    byDay.set(day, [...(byDay.get(day) ?? []), m.score]);
  }
  $('bars').replaceChildren(...[...byDay].map(([day, scores]) => {
    const dayAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${(dayAvg / 5) * 100}%`;
    bar.title = `${day}: ${dayAvg.toFixed(1)}/5`;
    return bar;
  }));
}

$('export').addEventListener('click', async () => {
  if (!(await limitsFor()).pro) return openUpgrade();
  const { moods } = await getState(['moods']);
  const csv = 'timestamp,score\n' + moods.map((m) => `${new Date(m.at).toISOString()},${m.score}`).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'emoh-moods.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('dev-pro').addEventListener('change', async (e) => {
  await setProForTesting(e.target.checked);
  render();
});

render();
