import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
          react(),
          VitePWA({
                  registerType: 'autoUpdate',
                  includeAssets: ['favicon.svg'],
                  manifest: {
                            name: 'AutoBuilt',
                            short_name: 'AutoBuilt',
                            description: 'Run your bookings, texts, and follow-ups from one app.',
                            theme_color: '#f6f1e7',
                            background_color: '#f6f1e7',
                            display: 'standalone',
                            orientation: 'portrait',
                            start_url: '/',
                            icons: [
                              { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                              { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                              { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                                      ],
                  },
                  workbox: {
                            navigateFallbackDenylist: [/^\/api\//],
                  },
          }),
        ],
    server: {
          port: 5173,
          proxy: {
                  '/api': 'http://localhost:4000',
          },
    },
})
