# Terminal theme + ANSI color module

A self-contained, drop-in theming system: nine macOS-Terminal-inspired palettes, an ANSI-style categorical color ramp for indexed swatches, a switcher UI, and `localStorage` persistence. No dependency on the host app — the React binding is a thin layer over a framework-agnostic core, and the palettes are plain CSS custom properties applied via `<html data-theme>`.

## Files

| File                         | Role                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `themes.css`                 | The palettes — `:root` default (Grass) plus a `[data-theme]` block per theme. Reusable tokens only. |
| `theme.ts`                   | Framework-agnostic core: `THEMES`, `loadTheme`, `saveTheme`, `applyTheme`, `isThemeId`, `ThemeId`.  |
| `useTheme.ts`                | React hook: `const [theme, setTheme] = useTheme()`.                                                 |
| `ThemeSwitcher.tsx` / `.css` | The presentational picker bar.                                                                      |
| `index.ts`                   | Barrel — side-effect-imports `themes.css`, re-exports the public API.                               |

## Usage (React)

```tsx
import { useTheme, ThemeSwitcher } from "./theme";

function App() {
  const [theme, setTheme] = useTheme(); // reads storage, syncs <html data-theme>
  return (
    <>
      <ThemeSwitcher theme={theme} onChange={setTheme} />
      {/* rest of the app — style it with the tokens below */}
    </>
  );
}
```

## Usage (no framework)

```ts
import { applyTheme, loadTheme } from "./theme";
import "./theme/themes.css";

applyTheme(loadTheme()); // apply the persisted (or default) theme on boot
// later, from a control: applyTheme("ocean");
```

## Token contract

Style the host app with these custom properties — they resolve to the active theme's palette. Derive any app-specific colors from them (e.g. `color-mix(in srgb, var(--accent) 64%, #fff 36%)`) rather than hard-coding hex, so the derivations track the theme.

| Token                          | Meaning                                          |
| ------------------------------ | ------------------------------------------------ |
| `--bg`, `--panel`, `--code-bg` | Surfaces: page / card / code background          |
| `--text`, `--text-h`           | Body text / heading (bright) text                |
| `--border`                     | Hairline border color                            |
| `--accent`, `--on-accent`      | Accent fill / readable text on the accent        |
| `--item-1` … `--item-10`       | ANSI-style categorical ramp for indexed swatches |
| `--item-forced`                | Extra violet slot outside the numbered ramp      |

`color-scheme` is set per theme (dark themes vs. the light ones), so native form controls and scrollbars match automatically.

## Persistence

The chosen theme is stored under `localStorage["mogo-theme"]` (`THEME_STORAGE_KEY` — rename to taste). Storage failures (e.g. `file://` origins, disabled storage) are swallowed: the theme still applies for the session, it just won't persist.
