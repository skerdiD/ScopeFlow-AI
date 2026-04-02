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
type ThemeTransition = { ready: Promise<void> };
type DocumentWithTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => ThemeTransition;
};

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

      const maxRadius = Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y)
      );
      document.documentElement.style.setProperty("--theme-origin-x", `${origin.x}px`);
      document.documentElement.style.setProperty("--theme-origin-y", `${origin.y}px`);
      document.documentElement.style.setProperty("--theme-end-radius", `${maxRadius}px`);

      const doc = document as DocumentWithTransition;
      if (!doc.startViewTransition) {
        setThemeState(nextTheme);
        return;
      }

      const transition = doc.startViewTransition(() => {
        setThemeState(nextTheme);
      });

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${origin.x}px ${origin.y}px)`,
              `circle(${Math.round(maxRadius * 0.45)}px at ${origin.x}px ${origin.y}px)`,
              `circle(${Math.round(maxRadius * 0.8)}px at ${origin.x}px ${origin.y}px)`,
              `circle(${maxRadius}px at ${origin.x}px ${origin.y}px)`
            ]
          },
          {
            duration: 580,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            pseudoElement: "::view-transition-new(root)"
          }
        );
      });
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
