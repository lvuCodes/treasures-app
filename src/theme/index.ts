// Terminal theme + ANSI color module. Drop this folder into any app: import
// from here and the palette stylesheet loads as a side effect, then use
// `useTheme` + `<ThemeSwitcher>` (React) or the vanilla core (`applyTheme`,
// `loadTheme`, …). See README.md for the token contract host CSS consumes.
import "./themes.css";

export { ThemeSwitcher } from "./ThemeSwitcher";
export { useTheme } from "./useTheme";
export {
  THEMES,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  loadTheme,
  saveTheme,
  isThemeId,
  type ThemeId,
  type ThemeOption,
} from "./theme";
