import "./ThemeSwitcher.css";
import { THEMES, type ThemeId } from "./theme";

interface ThemeSwitcherProps {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
  // Leading caption before the buttons. Pass "" to omit it.
  label?: string;
}

// Horizontal theme picker. Its styling consumes the same palette tokens it
// switches (--accent, --border, --code-bg, …), so the bar restyles itself as the
// active theme changes. Presentational only — state lives with the caller
// (typically the useTheme hook).
export function ThemeSwitcher({ theme, onChange, label = "Theme:" }: ThemeSwitcherProps) {
  return (
    <div className="theme-bar">
      {label && <span>{label}</span>}
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={"theme-btn" + (theme === t.id ? " active" : "")}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
