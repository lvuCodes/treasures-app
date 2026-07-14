import { useEffect, useState } from "react";
import { applyTheme, loadTheme, type ThemeId } from "./theme";

// React binding for the theme system. Holds the active theme in state and keeps
// <html data-theme> + localStorage in sync. Initial value is read lazily from
// storage so the first render already reflects the persisted choice.
//
//   const [theme, setTheme] = useTheme();
export function useTheme(): [ThemeId, (theme: ThemeId) => void] {
  const [theme, setTheme] = useState<ThemeId>(loadTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return [theme, setTheme];
}
