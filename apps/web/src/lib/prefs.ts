import { useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
export type PaletteName = 'lime' | 'mono' | 'ocean' | 'sage' | 'pastel';
export interface Prefs {
  theme: ThemePref;
  palette: PaletteName;
}

/** Must match the inline pre-paint script in index.html. */
const KEY = 'nexora:prefs:v2';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function read(): Prefs {
  try {
    return { theme: 'dark', palette: 'lime', ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>) };
  } catch {
    return { theme: 'dark', palette: 'lime' };
  }
}

let prefs = read();
const listeners = new Set<() => void>();

export function resolvedTheme(p = prefs) {
  return p.theme === 'system' ? (media.matches ? 'dark' : 'light') : p.theme;
}

function apply() {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme();
  root.dataset.palette = prefs.palette;
}

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* storage blocked: the change still applies for this session */
  }
  apply();
  listeners.forEach((l) => l());
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

/**
 * Applies a preference with a smooth transition: a circular reveal from the
 * click point where the browser supports View Transitions, a colour cross-fade otherwise.
 */
export function setPrefsAnimated(patch: Partial<Prefs>, origin?: { x: number; y: number }) {
  const doc = document as ViewTransitionDoc;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return setPrefs(patch);
  if (!doc.startViewTransition) {
    document.documentElement.classList.add('theme-fade');
    setPrefs(patch);
    window.setTimeout(() => document.documentElement.classList.remove('theme-fade'), 450);
    return;
  }
  const t = doc.startViewTransition(() => setPrefs(patch));
  if (!origin) return;
  t.ready.then(() => {
    const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
      { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
  });
}

media.addEventListener('change', () => {
  if (prefs.theme === 'system') {
    apply();
    listeners.forEach((l) => l());
  }
});
apply();

export function usePrefs() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs,
  );
}
