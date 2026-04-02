import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

type Theme = "light" | "dark";
type ThemeToggleOrigin = { x: number; y: number };

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme, origin?: ThemeToggleOrigin) => void;
  toggleTheme: (origin?: ThemeToggleOrigin) => void;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
};

const STORAGE_KEY = "scopeflow-theme";

function getInitialTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const animateThemeToggle = useCallback(
    (nextTheme: Theme, origin: ThemeToggleOrigin) => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) {
        setThemeState(nextTheme);
        return;
      }

      const existing = document.querySelector<HTMLElement>(".theme-reveal-overlay");
      if (existing) {
        existing.remove();
      }

      const overlay = document.createElement("span");
      overlay.className = "theme-reveal-overlay";

      const startSize = 14;
      const maxRadius = Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y)
      );
      const scale = maxRadius / (startSize / 2);

      overlay.style.width = `${startSize}px`;
      overlay.style.height = `${startSize}px`;
      overlay.style.left = `${origin.x}px`;
      overlay.style.top = `${origin.y}px`;
      overlay.style.background = nextTheme === "dark" ? "#020617" : "#f8fafc";

      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        overlay.style.transform = `translate(-50%, -50%) scale(${scale})`;
      });

      window.setTimeout(() => {
        setThemeState(nextTheme);
        overlay.style.opacity = "0";
        window.setTimeout(() => overlay.remove(), 220);
      }, 480);
    },
    []
  );

  const setTheme = useCallback(
    (nextTheme: Theme, origin?: ThemeToggleOrigin) => {
      if (nextTheme === theme) {
        return;
      }

      if (origin) {
        animateThemeToggle(nextTheme, origin);
        return;
      }

      setThemeState(nextTheme);
    },
    [animateThemeToggle, theme]
  );

  const toggleTheme = useCallback(
    (origin?: ThemeToggleOrigin) => {
      const nextTheme = theme === "dark" ? "light" : "dark";
      setTheme(nextTheme, origin);
    },
    [setTheme, theme]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme
    }),
    [setTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
