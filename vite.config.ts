import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Vite config for Emoh PWA
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['emoh-icon.svg', 'bible.json', 'bible-embeddings.bin'],
      manifest: false, // We have a custom manifest.json in public/
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB limit for WASM files
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wasm,bin}']
      }
    })
  ],
  // Exclude heavy WASM/ONNX from pre-bundling — loaded at runtime
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  build: {
    target: 'es2020'
  },
  // Enable top-level await for WASM modules
  esbuild: {
    supported: {
      'top-level-await': true,
    },
  },
});
