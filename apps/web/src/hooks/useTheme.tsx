import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme =
  | 'minimalist'
  | 'monochrome-dark'
  | 'earthy'
  | 'glassmorphism'
  | 'cyberpunk'
  | 'retro-pixel'
  | 'neobrutalism'
  | 'vaporwave'
  | 'frutiger-aero'
  | 'noisy-cartoon';

export interface ThemeMeta {
  id: Theme;
  number: string;
  name: string;
  description: string;
  isDark: boolean;
  accentColor: string;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
}

export const THEMES_LIST: ThemeMeta[] = [
  {
    id: 'minimalist',
    number: '01',
    name: 'Dull & Minimalist',
    description: 'Calm matte off-white, whisper-thin lines, quiet Scandinavian editorial.',
    isDark: false,
    accentColor: '#1c1917',
    previewBg: '#ebebeb',
    previewCard: '#dfdfdf',
    previewAccent: '#292524',
  },
  {
    id: 'monochrome-dark',
    number: '02',
    name: 'Monochromatic Dark',
    description: 'Pitch obsidian, graphite cards, pure high-contrast monochrome elegance.',
    isDark: true,
    accentColor: '#ffffff',
    previewBg: '#09090b',
    previewCard: '#18181b',
    previewAccent: '#fafafa',
  },
  {
    id: 'earthy',
    number: '03',
    name: 'Earthy & Natural',
    description: 'Soft sage green, warm botanical sand, organic leaf silhouettes & moss.',
    isDark: false,
    accentColor: '#4a5848',
    previewBg: '#c7d2c3',
    previewCard: '#f4f0e8',
    previewAccent: '#ea7317',
  },
  {
    id: 'glassmorphism',
    number: '04',
    name: 'Glassmorphism',
    description: 'Cosmic aurora fluid mesh gradient, heavy frosted glass & luminous glow.',
    isDark: true,
    accentColor: '#818cf8',
    previewBg: 'linear-gradient(135deg, #1e1b4b, #ec4899, #3b82f6)',
    previewCard: 'rgba(255, 255, 255, 0.18)',
    previewAccent: '#06b6d4',
  },
  {
    id: 'cyberpunk',
    number: '05',
    name: 'Cyberpunk Neon',
    description: 'Sci-fi tech void, laser neon magenta & cyan borders, HUD telemetry.',
    isDark: true,
    accentColor: '#00f0ff',
    previewBg: '#050713',
    previewCard: '#0d122b',
    previewAccent: '#ff007f',
  },
  {
    id: 'retro-pixel',
    number: '06',
    name: 'Retro 90s Pixel',
    description: 'Classic Windows 95 grey, 3D beveled borders, retro floppy & pixel nostalgia.',
    isDark: false,
    accentColor: '#000080',
    previewBg: '#c0c0c0',
    previewCard: '#dfdfdf',
    previewAccent: '#000080',
  },
  {
    id: 'neobrutalism',
    number: '07',
    name: 'Neobrutalism',
    description: 'Electric canary yellow, solid 2.5px black borders, hard unblurred drop shadows.',
    isDark: false,
    accentColor: '#000000',
    previewBg: '#ffe500',
    previewCard: '#ffffff',
    previewAccent: '#ff5722',
  },
  {
    id: 'vaporwave',
    number: '08',
    name: 'Vaporwave Dream',
    description: 'Pastel lavender sunset, neon palm trees, retro wireframe horizon.',
    isDark: false,
    accentColor: '#ec4899',
    previewBg: 'linear-gradient(180deg, #d8b4e2, #fbcfe8)',
    previewCard: 'rgba(255, 255, 255, 0.85)',
    previewAccent: '#22d3ee',
  },
  {
    id: 'frutiger-aero',
    number: '09',
    name: 'Frutiger Aero',
    description: 'Aqua sky-blue water reflections, bubbles, 3D glossy orb specular pills.',
    isDark: false,
    accentColor: '#0284c7',
    previewBg: 'linear-gradient(180deg, #38bdf8, #34d399)',
    previewCard: 'rgba(255, 255, 255, 0.88)',
    previewAccent: '#10b981',
  },
  {
    id: 'noisy-cartoon',
    number: '10',
    name: 'Noisy Cartoon',
    description: 'Pop-art comic hot pink, comic halftone dots, bold black ink outlines & stickers.',
    isDark: false,
    accentColor: '#000000',
    previewBg: '#ff2a85',
    previewCard: '#facc15',
    previewAccent: '#22c55e',
  },
];

interface ThemeContextType {
  theme: Theme;
  themeMeta: ThemeMeta;
  themesList: ThemeMeta[];
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function normalizeTheme(raw: string | null): Theme {
  if (!raw) return 'monochrome-dark';
  // Backward compatibility mappings
  if (raw === 'dark') return 'monochrome-dark';
  if (raw === 'light') return 'minimalist';
  const found = THEMES_LIST.find((t) => t.id === raw);
  return found ? found.id : 'monochrome-dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatso_theme');
      if (saved) return normalizeTheme(saved);
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'minimalist';
      }
    }
    return 'monochrome-dark';
  });

  const themeMeta = THEMES_LIST.find((t) => t.id === theme) || THEMES_LIST[1];
  const isDark = themeMeta.isDark;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('chatso_theme', theme);
    const root = document.documentElement;

    // Set data-theme attribute on <html>
    root.setAttribute('data-theme', theme);

    // Synchronize Tailwind dark / light classes
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme, isDark]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const idx = THEMES_LIST.findIndex((t) => t.id === prev);
      const nextIdx = (idx + 1) % THEMES_LIST.length;
      return THEMES_LIST[nextIdx].id;
    });
  };

  const setTheme = (t: Theme) => setThemeState(t);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMeta,
        themesList: THEMES_LIST,
        isDark,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
