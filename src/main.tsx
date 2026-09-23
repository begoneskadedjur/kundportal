// src/main.tsx - FIXED VERSION utan StrictMode för att lösa dubbel-rendering
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
// Fångar webbläsarens installationserbjudande innan appen hunnit rendera,
// så knappen under Mitt konto kan öppna det senare (se lib/pwaInstall.ts)
import './lib/pwaInstall'

// FIX: Tar bort React.StrictMode för att undvika dubbel-körning av useEffect
// StrictMode orsakar dubbel-rendering i utvecklingsläge vilket kan skapa
// auth loops och oändlig loading
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)