import { THEME_STORAGE_KEY, isThemeId, saveTheme } from "@lvucodes/ui";

// Seed the lvuCodes theme for first-time visitors while respecting an existing
// choice. The storage key is shared across every site on this origin, so a
// visitor who already picked a theme elsewhere keeps it; only an empty or
// invalid slot is defaulted to lvuCodes before useTheme() reads it.
export function seedDefaultTheme(): void {
  let stored: string | null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    stored = null;
  }
  if (!isThemeId(stored)) {
    saveTheme("lvucodes");
  }
}
