// Thin wrapper over chrome.storage.local. All user data stays on-device.

export const DEFAULTS = {
  blockedSites: [],   // ["youtube.com", ...]
  focus: null,        // { endsAt: epoch ms, minutes } while a session runs
  moods: [],          // [{ score: 1-5, at: epoch ms }]
  pro: false,         // set by lib/license.js
};

export async function getState(keys = Object.keys(DEFAULTS)) {
  const defaults = Object.fromEntries(keys.map((k) => [k, DEFAULTS[k]]));
  return chrome.storage.local.get(defaults);
}

export function setState(patch) {
  return chrome.storage.local.set(patch);
}

// "https://www.YouTube.com/watch?v=1" -> "youtube.com"
export function normalizeDomain(input) {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z]+:\/\//.test(s)) s = 'https://' + s;
  try {
    const host = new URL(s).hostname.replace(/^www\./, '');
    return host.includes('.') ? host : null;
  } catch {
    return null;
  }
}
