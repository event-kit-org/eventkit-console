import { type ReactNode, useEffect, useState } from 'react';
import { type Theme, ThemeContext } from '@/lib/theme';

/** Also read by the snippet in index.html, which sets the class before React loads. */
const STORAGE_KEY = 'eventkit.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function stored(): Theme {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/** Light, dark or the system's choice, kept as the `dark` class on <html>. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(stored);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      // Switch every colour at once, not through each element's own transition.
      const still = document.createElement('style');
      still.textContent = '*,*::before,*::after{transition:none!important}';
      document.head.appendChild(still);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
      void getComputedStyle(document.body).color;
      requestAnimationFrame(() => still.remove());
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (next: Theme) => {
    try {
      if (next === 'system') window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // not remembered
    }
    setThemeState(next);
  };

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}
