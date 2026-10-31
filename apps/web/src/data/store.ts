import { useSyncExternalStore } from 'react';
import { buildSeed, DB_VERSION } from './seed';
import type { DB, DomainEvent, ID } from './types';

/**
 * Local-first store. Phase 3 replaces persistence with the API; the commit/event
 * contract stays the same so screens and the automation engine don't change.
 */
const KEY = 'nexora:db:v2';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    /* corrupt or blocked storage: fall back to seed */
  }
  return buildSeed();
}

let db: DB = load();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

function persist() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* quota or private mode: keep working in memory */
    }
  }, 150);
}

type EventHandler = (events: DomainEvent[]) => void;
let onEvents: EventHandler = () => {};
export function setEventHandler(handler: EventHandler) {
  onEvents = handler;
}

let uid = 0;
export function newId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${(uid++).toString(36)}`;
}

export interface CommitOptions {
  audit?: { action: string; target: string };
  events?: DomainEvent[];
}

/** Applies a mutation to a copy of the database, persists it, then fires domain events. */
export function commit(recipe: (draft: DB) => void, opts: CommitOptions = {}) {
  const draft = structuredClone(db);
  recipe(draft);
  if (opts.audit) {
    draft.audit.unshift({ id: newId('au'), at: new Date().toISOString(), userId: draft.currentUserId, ...opts.audit });
    draft.audit.length = Math.min(draft.audit.length, 500);
  }
  db = draft;
  persist();
  listeners.forEach((l) => l());
  if (opts.events?.length) queueMicrotask(() => onEvents(opts.events!));
}

export function getDB() {
  return db;
}

export function resetDB() {
  db = buildSeed();
  persist();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDB() {
  return useSyncExternalStore(subscribe, getDB);
}

export function useMe() {
  const d = useDB();
  return d.users.find((u) => u.id === d.currentUserId)!;
}

export function userName(d: DB, id: ID | undefined) {
  return d.users.find((u) => u.id === id)?.name ?? 'Unassigned';
}
