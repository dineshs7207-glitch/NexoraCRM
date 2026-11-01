import { useSyncExternalStore } from 'react';
import { buildSeed, DB_VERSION } from './seed';
import type { DB, DomainEvent, ID } from './types';

/**
 * Local-first store. Signed in, the workspace is loaded from Supabase (see remote.ts) and every
 * commit is handed to the sync hook; the commit/event contract stays the same so screens don't change.
 */
const KEY = 'nexora:db:v2';
let storageKey = KEY;

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
      localStorage.setItem(storageKey, JSON.stringify(db));
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

type CommitHook = (prev: DB, next: DB) => void;
let onCommit: CommitHook = () => {};
export function setCommitHook(hook: CommitHook) {
  onCommit = hook;
}

/** Record ids are UUIDs so they can be stored in Supabase as they are. The prefix only documents the kind. */
export function newId(_prefix: string) {
  return crypto.randomUUID();
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
  const prev = db;
  db = draft;
  persist();
  listeners.forEach((l) => l());
  onCommit(prev, draft);
  if (opts.events?.length) queueMicrotask(() => onEvents(opts.events!));
}

export function getDB() {
  return db;
}

/** Swaps in a workspace loaded from Supabase; it is cached in this browser under its own key. */
export function replaceDB(next: DB, key: string) {
  storageKey = key;
  db = next;
  persist();
  listeners.forEach((l) => l());
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
