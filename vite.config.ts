import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import path from 'node:path'

function loadDevHttps() {
  const certDir = path.resolve(__dirname, 'certs')
  const keyPath = path.join(certDir, 'dev-key.pem')
  const certPath = path.join(certDir, 'dev-cert.pem')

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    return undefined
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  }
}

const devHttps = loadDevHttps()

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Golosuy',
        short_name: 'Golosuy',
        description:
          'Сервис для отметки бюллетеня на фото. Все данные обрабатываются только на вашем устройстве.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        lang: 'ru',
        start_url: '.',
        icons: [
          {
            src: 'icons.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: true,
    https: devHttps,
  },
  preview: {
    host: true,
    https: devHttps,
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
