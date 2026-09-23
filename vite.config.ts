import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// ---------------------------------------------------------------------------
// Byggstämpel och version.json
// ---------------------------------------------------------------------------
// Appen jämför sin inbyggda byggstämpel mot /version.json när den kommer
// tillbaka i förgrunden (se src/hooks/useVersionWatch.ts). Skiljer de sig
// visas "Ny version finns" och nästa sidbyte laddar om. Stämpeln är commit-id
// från Vercel, annars lokal git, annars en tidsstämpel.

function resolveBuildId(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA
  if (fromVercel) return fromVercel.slice(0, 12)
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return String(Date.now())
  }
}

// Senaste versionen i uppdateringsloggen (första version: '...' i filen).
// Läses som text i stället för import så vite.config inte drar in src/ i
// tsconfig.node-projektet.
function resolveAppVersion(): string {
  try {
    const source = readFileSync(new URL('./src/constants/changelog.ts', import.meta.url), 'utf8')
    return source.match(/version:\s*'([^']+)'/)?.[1] ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

const BUILD_ID = resolveBuildId()
const APP_VERSION = resolveAppVersion()
const BUILT_AT = new Date().toISOString()

function versionFilePlugin(): Plugin {
  return {
    name: 'begone-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION, build: BUILD_ID, builtAt: BUILT_AT }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_BUILD__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    versionFilePlugin(),
    // Portalen som app på hemskärmen (PWA). Service workern är avsiktligt
    // försiktig eftersom vi deployar flera gånger om dagen:
    //   - HTML hämtas alltid från nätet först, så en ny deploy slår igenom vid
    //     nästa start. Bara utan nät används den senast sparade sidan.
    //   - Hashade byggfiler under /assets/ cachas, de ändras aldrig.
    //   - /api, Supabase, Google Maps, version.json och allt annat rörs inte.
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
