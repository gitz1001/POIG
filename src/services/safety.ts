/* ============================================================
   Safety Service — local keyword detection for self-harm
   ============================================================ */

const SELF_HARM_KEYWORDS = [
  'suicide',
  'kill myself',
  'end it all',
  'want to die',
  'better off dead',
  'hurt myself',
  'cut myself',
  'don\'t want to live',
  'no reason to live',
  'magpakamatay',
  'tapusin na lahat',
  'wala ng kwenta',
  'ayoko na mabuhay'
];

/**
 * Check if the user's input contains self-harm intent.
 */
export function containsSelfHarm(text: string): boolean {
  const normalized = text.toLowerCase();
  return SELF_HARM_KEYWORDS.some(keyword => normalized.includes(keyword));
}

export const SAFETY_RESPONSE = "I hear you, and I'm so glad you told me. You are not alone, and your life has value. I'm just an AI and not a counselor, but there are people who really want to support you right now. Please reach out to them:";

export const SAFETY_RESOURCES = [
  { name: 'Hopeline PH', contact: '0917-558-4673 or 2919' },
  { name: 'NCMH Crisis Hotline', contact: '0966-351-4518 or 1553' },
  { name: 'In Touch Community Services', contact: '02-8893-7603' }
];
