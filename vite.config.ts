import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Portalen som app på hemskärmen (PWA). Service workern är avsiktligt
    // försiktig eftersom vi deployar flera gånger om dagen:
    //   - HTML hämtas alltid från nätet först, så en ny deploy slår igenom vid
    //     nästa start. Bara utan nät används den senast sparade sidan.
    //   - Hashade byggfiler under /assets/ cachas, de ändras aldrig.
    //   - /api, Supabase, Google Maps och allt annat rörs inte.
    //   - registerType 'prompt' utan prompt: ingen automatisk omladdning mitt i
    //     ett arbetspass. Ny service worker tar över när appen startas om.
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-icon.svg'],
      manifest: {
        id: '/',
        name: 'BeGone Kundportal',
        short_name: 'BeGone',
        description: 'BeGone Skadedjur & Sanering: ärenden, schema, stationer och kundportal',
        lang: 'sv',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Förcacha bara ikonerna. Sidan och byggfilerna hanteras vid körning.
        globPatterns: ['*.{svg,png}'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin, url }) =>
              sameOrigin && request.mode === 'navigate' && !url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'begone-shell',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 10 },
            },
          },
          {
            urlPattern: ({ request, sameOrigin, url }) =>
              sameOrigin &&
              url.pathname.startsWith('/assets/') &&
              (request.destination === 'script' || request.destination === 'style' || request.destination === 'font'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'begone-assets',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  optimizeDeps: {
    include: ['lucide-react', 'framer-motion']
  }
})
