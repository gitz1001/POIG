# 🧸 Emoh — Your Local Buddy

*A safe space for your mind. Meet your local buddy, Emoh.*

Emoh is a privacy-first emotional companion app built for the AppBuildersPH Hackathon 2026. A friendly mascot listens to you, remembers you, and replies warmly. **Everything runs in the browser, offline, with zero data leaving your device.**

---

## ✨ Features
1. **Fully Local AI**: Uses `@mlc-ai/web-llm` and `@huggingface/transformers` to run the Qwen2.5-1.5B LLM, Whisper STT, and MiniLM embeddings entirely in the browser using WebGPU and WebAssembly.
2. **Liquid Glass UI**: A beautiful, translucent, minimal interface with an original SVG mascot animated via pure CSS.
3. **RAG Memory System**: Automatically retrieves past journal entries and tracks mood trends to contextualize Emoh's responses.
4. **Offline PWA**: Once the models are downloaded, Emoh works completely offline. Perfect for areas with spotty internet.
5. **Private Backup**: Export and import your data anytime, encrypted locally via AES-GCM using a PBKDF2 derived key from your 4-digit PIN.
6. **Safety First**: Local keyword detection for self-harm triggers real-world support resources (Hopeline PH, NCMH), bypassing the AI entirely for critical situations.

## 🚀 How to Run Locally

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open the provided `localhost` URL in Chrome, Edge, or any WebGPU-capable browser.

## 📦 What Requires Internet?
Only the **initial model download** (approx. 1GB) during the onboarding process.

## 🛑 What Runs Locally?
**Literally everything else.**
- LLM Inference (Web-LLM)
- Embeddings & Vector Search
- Speech-to-Text (Whisper)
- Chat History (IndexedDB)
- Backup Encryption (Web Crypto API)

After the initial setup, **there are zero external network calls. No analytics. No telemetry.**

## 🧠 Models Used
- **LLM**: `Qwen2.5-1.5B-Instruct` (Quantized to q4f16_1 for Web-LLM)
- **Embeddings**: `Xenova/all-MiniLM-L6-v2` (transformers.js)
- **STT**: `Xenova/whisper-tiny` (transformers.js)

## 💡 Why Local AI?
Emoh handles deeply personal emotional conversations. Running AI locally means these private thoughts **never leave the user's device**. There are no API costs, no data breaches, no corporate access to your feelings. 

In the Philippines, where internet connectivity can be unreliable, Emoh works flawlessly offline. Local AI makes emotional support **private, free, and always available**.
