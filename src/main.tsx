import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The package.json `sideEffects` allowlist marks first-party modules pure so the
// dev-only folder tree-shakes out of production. Rollup does not honour those
// globs for app source, so the theme barrel's own `import "./themes.css"` gets
// dropped from the bundle — the palette must be pulled in from the entry, which
// is never shaken, or the built app ships with no colour tokens at all.
import './theme/themes.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
