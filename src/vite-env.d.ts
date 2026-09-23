/// <reference types="vite/client" />

// Byggstämplar som vite.config.ts skriver in vid bygget (define).
// Jämförs mot /version.json i src/hooks/useVersionWatch.ts.
declare const __APP_VERSION__: string
declare const __APP_BUILD__: string
