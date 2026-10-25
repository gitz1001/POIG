import { getState, setState, normalizeDomain } from '../lib/store.js';
import { limitsFor, openUpgrade, PRO_FOCUS_MINUTES } from '../lib/license.js';

const $ = (id) => document.getElementById(id);
let tick;

function showError(text) {
  $('error').textContent = text;
}

async function render() {
  const limits = await limitsFor();
  const { blockedSites, focus } = await getState(['blockedSites', 'focus']);

  $('plan').hidden = !limits.pro;
  $('upgrade').hidden = limits.pro;

  // Durations: free users see Pro options disabled, which doubles as an upsell.
  $('minutes').innerHTML = PRO_FOCUS_MINUTES.map((m) => {
    const locked = !limits.focusMinutes.includes(m);
    return `<option value="${m}" ${locked ? 'disabled' : ''} ${m === 25 ? 'selected' : ''}>
      ${m} min${locked ? ' 🔒 Pro' : ''}</option>`;
  }).join('');

  const cap = limits.blockedSites === Infinity ? '' : `(${blockedSites.length}/${limits.blockedSites})`;
  $('count').textContent = cap;
  $('sites').replaceChildren(...blockedSites.map((domain) => {
    const li = document.createElement('li');
    li.textContent = domain;
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.title = `Remove ${domain}`;
    remove.onclick = async () => {
      await setState({ blockedSites: blockedSites.filter((d) => d !== domain) });
      render();
    };
    li.append(remove);
    return li;
  }));

  clearInterval(tick);
  $('idle').hidden = !!focus;
  $('running').hidden = !focus;
  if (focus) {
    const update = () => {
      const left = Math.max(0, focus.endsAt - Date.now());
      const mm = String(Math.floor(left / 60_000)).padStart(2, '0');
      const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0');
      $('timer').textContent = `${mm}:${ss}`;
      if (left === 0) render();
    };
    update();
    tick = setInterval(update, 1000);
  }
}

$('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const domain = normalizeDomain($('site').value);
  if (!domain) return showError('Enter a valid site, like reddit.com');

  const limits = await limitsFor();
  const { blockedSites } = await getState(['blockedSites']);
  if (blockedSites.includes(domain)) return showError('Already on your list.');
  if (blockedSites.length >= limits.blockedSites) {
    return showError(`Free plan blocks up to ${limits.blockedSites} sites. Go Pro for unlimited.`);
  }
  await setState({ blockedSites: [...blockedSites, domain] });
  $('site').value = '';
  render();
});

$('start').addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'startFocus', minutes: Number($('minutes').value) });
  if (!res.ok) showError(res.error);
  render();
});

$('stop').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'stopFocus' });
  render();
});

$('moods').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-score]');
  if (!btn) return;
  const { moods } = await getState(['moods']);
  await setState({ moods: [...moods, { score: Number(btn.dataset.score), at: Date.now() }] });
  document.querySelectorAll('#moods button').forEach((b) => b.classList.toggle('picked', b === btn));
});

$('upgrade').addEventListener('click', openUpgrade);

render();
