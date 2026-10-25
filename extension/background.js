// Service worker: runs focus sessions and blocks sites with declarativeNetRequest.

import { getState, setState } from './lib/store.js';
import { limitsFor } from './lib/license.js';

const FOCUS_ALARM = 'focus-end';

async function applyBlockRules(active) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const { blockedSites } = await getState(['blockedSites']);
  const addRules = active
    ? blockedSites.map((domain, i) => ({
        id: i + 1,
        priority: 1,
        action: { type: 'redirect', redirect: { extensionPath: '/blocked/blocked.html' } },
        condition: { requestDomains: [domain], resourceTypes: ['main_frame'] },
      }))
    : [];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules,
  });
}

async function startFocus(minutes) {
  const { focusMinutes } = await limitsFor();
  if (!focusMinutes.includes(minutes)) throw new Error('That duration is a Pro feature.');
  const endsAt = Date.now() + minutes * 60_000;
  await setState({ focus: { endsAt, minutes } });
  await chrome.alarms.create(FOCUS_ALARM, { when: endsAt });
  await applyBlockRules(true);
}

async function stopFocus({ completed }) {
  await chrome.alarms.clear(FOCUS_ALARM);
  await setState({ focus: null });
  await applyBlockRules(false);
  if (completed) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Focus session done 🎉',
      message: 'Nice work. How are you feeling? Click the Emoh icon to check in.',
    });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    startFocus: () => startFocus(msg.minutes),
    stopFocus: () => stopFocus({ completed: false }),
  };
  const handler = handlers[msg.type];
  if (!handler) return false;
  handler()
    .then(() => sendResponse({ ok: true }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true; // keep the channel open for the async response
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FOCUS_ALARM) stopFocus({ completed: true });
});

// Keep rules in sync if the user edits the list mid-session.
chrome.storage.onChanged.addListener(async (changes) => {
  if (!changes.blockedSites) return;
  const { focus } = await getState(['focus']);
  if (focus) applyBlockRules(true);
});

// Recover from a browser restart: end expired sessions, keep live ones.
chrome.runtime.onStartup.addListener(async () => {
  const { focus } = await getState(['focus']);
  if (focus && focus.endsAt <= Date.now()) stopFocus({ completed: true });
});
