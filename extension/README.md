# Emoh Focus — Chrome Extension

A freemium Manifest V3 extension built on the Emoh brand: block distracting sites during focus
sessions, check in with your mood, and see your mood trend. All data stays in `chrome.storage.local`.

| Feature | Free | Pro |
|---|---|---|
| Focus sessions | 25 min | 15 / 25 / 45 / 60 / 90 min |
| Blocked sites | 3 | Unlimited |
| Mood history | Last 7 days | All-time |
| CSV export | — | ✓ |

## File map

```
extension/
├── manifest.json        # What Chrome reads first: name, permissions, entry points
├── background.js        # Service worker: timers (alarms) + site blocking (declarativeNetRequest)
├── lib/store.js         # chrome.storage wrapper + domain normalizer
├── lib/license.js       # Free vs Pro limits — the one file to change for payments
├── popup/               # The window that opens when you click the toolbar icon
├── options/             # Mood history page (+ DEV-only "simulate Pro" toggle)
├── blocked/             # Page shown instead of a blocked site
├── ui.css               # Shared styles (light + dark)
└── icons/               # 16/32/48/128 px PNGs (Chrome needs PNG, not SVG)
```

## Step 1: Load it in Chrome (2 minutes)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this `extension/` folder
4. Pin Emoh Focus from the puzzle-piece menu

After editing code, click the ↻ reload button on the extension card. To debug the
service worker, click **Inspect views: service worker** on the same card.

## Step 2: Try it

1. Add `youtube.com` in the popup → **Start focus**
2. Visit youtube.com → you land on the breathing page instead
3. Tap a mood face, then open **Mood history**
4. In Mood history, tick **Simulate Pro** to test Pro features

## Step 3: How the pieces talk

- **Popup → service worker:** `chrome.runtime.sendMessage({ type: 'startFocus', minutes })`
- **Service worker** saves `focus.endsAt`, sets a `chrome.alarms` alarm, and adds
  `declarativeNetRequest` redirect rules (one per blocked domain).
- **Alarm fires** → rules removed → notification asks how you feel.
- Service workers are killed when idle, so nothing is held in memory. State lives in storage,
  timing lives in alarms. This is the #1 thing beginners get wrong in MV3.

## Step 4: Publish to the Chrome Web Store

1. Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (one-time US$5 fee).
2. **Before you zip:** delete the "Simulate Pro" section in `options/options.html` and its
   handler in `options/options.js`, and set a real `UPGRADE_URL` in `lib/license.js`.
3. Zip the *contents* of `extension/` (manifest.json at the zip root).
4. Upload, then fill in: description, 1280×800 screenshots, a 440×280 promo tile,
   a privacy policy URL, and a justification for each permission.
5. Review usually takes a few days. `<all_urls>` host access is needed for redirect rules and can
   slow review, so justify it clearly ("redirect user-chosen sites to a focus page").

## Step 5: Add payments (ExtensionPay)

Google shut down Chrome Web Store Payments, so extensions use a third party.
[ExtensionPay](https://extensionpay.com) (Stripe under the hood) is the simplest:

1. Create an account and an extension ID on extensionpay.com, set your price.
2. Copy `ExtPay.js` from the `extpay` npm package into `lib/`.
3. In `background.js`: `ExtPay('your-id').startBackground();`
   and add `"https://extensionpay.com/*"` to `host_permissions`.
4. Rewrite `isPro()` and `openUpgrade()` in `lib/license.js`:

   ```js
   const extpay = ExtPay('your-id');
   export async function isPro() { return (await extpay.getUser()).paid; }
   export function openUpgrade() { extpay.openPaymentPage(); }
   ```

Nothing else changes, because every feature check already goes through `limitsFor()`.

## Pricing suggestion

Start with **US$2.99/month or US$19 lifetime**. Lifetime deals convert well early and fund
the first months; switch to subscription-only once you have reviews.

## Ideas for Pro v2

- Scheduled focus (e.g. auto-block 9–12 on weekdays)
- Mood ↔ focus correlation ("you feel better on days with 2+ sessions")
- Sync with the Emoh web app's journal
