import type { Currency } from '../data/types';

const LOCALE: Record<Currency, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
  AED: 'en-AE',
  SGD: 'en-SG',
};

export const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

const fmtCache = new Map<string, Intl.NumberFormat>();
function nf(key: string, make: () => Intl.NumberFormat) {
  let f = fmtCache.get(key);
  if (!f) fmtCache.set(key, (f = make()));
  return f;
}

export function money(value: number, currency: Currency, opts: { compact?: boolean; cents?: boolean } = {}) {
  const { compact = false, cents = false } = opts;
  const key = `${currency}|${compact}|${cents}`;
  return nf(key, () =>
    new Intl.NumberFormat(LOCALE[currency], {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : cents ? 2 : 0,
      minimumFractionDigits: cents ? 2 : 0,
    }),
  ).format(value);
}

export function num(value: number, compact = false) {
  return nf(`n|${compact}`, () =>
    new Intl.NumberFormat('en-IN', { notation: compact ? 'compact' : 'standard', maximumFractionDigits: 1 }),
  ).format(value);
}

export function pct(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

const DAY = 86_400_000;

export function daysBetween(a: Date | string, b: Date | string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);
}

export function relTime(iso: string, now = Date.now()) {
  const diff = now - new Date(iso).getTime();
  const future = diff < 0;
  const s = Math.abs(diff) / 1000;
  let out: string;
  if (s < 60) return 'just now';
  if (s < 3600) out = `${Math.round(s / 60)} min`;
  else if (s < 86_400) out = `${Math.round(s / 3600)} hr`;
  else if (s < 86_400 * 2) return future ? 'tomorrow' : 'yesterday';
  else if (s < 86_400 * 30) out = `${Math.round(s / 86_400)} days`;
  else return shortDate(iso);
  return future ? `in ${out}` : `${out} ago`;
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function monthLabel(d: Date) {
  return d.toLocaleDateString('en-GB', { month: 'short' });
}

export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Stable soft tint from a string, used for initials avatars. */
export function hueOf(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

export function deltaPct(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}
