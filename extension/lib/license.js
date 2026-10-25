// Free vs Pro gating. This is the ONLY file you change to plug in real payments.
// See extension/README.md → "Step 5: Add payments (ExtensionPay)".

import { getState, setState } from './store.js';

export const FREE_LIMITS = {
  blockedSites: 3,
  focusMinutes: [25],
  moodHistoryDays: 7,
};

export const PRO_FOCUS_MINUTES = [15, 25, 45, 60, 90];

// Replace with your ExtensionPay / Stripe Payment Link / Gumroad URL.
export const UPGRADE_URL = 'https://example.com/emoh-focus-pro';

export async function isPro() {
  const { pro } = await getState(['pro']);
  return pro === true;
}

export async function limitsFor() {
  const pro = await isPro();
  return {
    pro,
    blockedSites: pro ? Infinity : FREE_LIMITS.blockedSites,
    focusMinutes: pro ? PRO_FOCUS_MINUTES : FREE_LIMITS.focusMinutes,
    moodHistoryDays: pro ? Infinity : FREE_LIMITS.moodHistoryDays,
  };
}

export function openUpgrade() {
  chrome.tabs.create({ url: UPGRADE_URL });
}

// Development only: lets you test Pro features before payments exist.
// Remove the toggle in options.html before publishing.
export function setProForTesting(value) {
  return setState({ pro: value });
}
