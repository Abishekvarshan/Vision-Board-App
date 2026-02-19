import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
          'Cross-Origin-Embedder-Policy': 'unsafe-none',
        },
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          devOptions: {
            enabled: mode !== 'development',
          },
          includeAssets: ['favicon.svg', 'pwa/apple-touch-icon.png'],
          manifest: {
            name: 'Vision Board',
            short_name: 'VisionBoard',
            description: 'Vision board, daily planner, and streak tracker.',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            theme_color: '#4f46e5',
            background_color: '#f8fafc',
            icons: [
              {
                src: '/pwa/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
              },
              {
                src: '/pwa/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
              },
              {
                src: '/pwa/icon-192-maskable.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
              },
              {
                src: '/pwa/icon-512-maskable.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          },
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor':    ['react', 'react-dom'],
              'firebase-vendor': ['firebase'],
              'genai-vendor':    ['@google/genai'],
              'icons-vendor':    ['lucide-react'],
            }
          }
        }
      }
    };
});