import { db, setSyncBypass, SETTINGS_ID } from "./db";
import { getStoredToken, clearSession } from "./auth";
import type {
  AppSettings,
  CourseMaster,
  SimpleMasterValue,
  StudentRecord,
} from "./types";

/**
 * Multi-device sync client.
 *
 * Talks to the backend's /api/sync/{pull,push} endpoints to keep four Dexie
 * tables in step across browsers/computers: students, settings, courses,
 * simpleMaster.
 *
 * Every write you make locally is marked `dirty=1` by the Dexie hooks in
 * db.ts; sync.ts ships those dirty rows on its next push and clears the flag
 * on success. Pulling from the server applies remote changes with the sync
 * bypass on so the hooks don't re-mark them dirty.
 *
 * Conflict policy: last-write-wins per row, using `updatedAt`. Deletes are
 * soft (deleted=1) so peers learn to remove them on their next pull.
 *
 * Cadence: an initial sync fires when `startBackgroundSync()` is called
 * (typically on login). After that, every 30 seconds, on window focus, and
 * when the browser comes back online.
 */

const API = (import.meta.env.VITE_AUTH_API || "http://localhost:4000").replace(/\/+$/, "");
const LAST_PULLED_KEY = "rite:sync:lastPulledAt";

const TABLES = ["students", "settings", "courses", "simpleMaster"] as const;
type TableKey = (typeof TABLES)[number];

type AnyRow = StudentRecord | AppSettings | CourseMaster | SimpleMasterValue;

interface PullItem {
  syncId: string;
  data: AnyRow;
  updatedAt: number;
  deleted: boolean;
}
interface PullResponse {
  ok: boolean;
  serverTime: number;
  students?: PullItem[];
  settings?: PullItem[];
  courses?: PullItem[];
  simpleMaster?: PullItem[];
  error?: string;
}

function tableFor(key: TableKey) {
  switch (key) {
    case "students":     return db.students;
    case "settings":     return db.settings;
    case "courses":      return db.courses;
    case "simpleMaster": return db.simpleMaster;
  }
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Status flag flipped by sync passes so we never run two simultaneously. */
let syncInFlight = false;

/** Callback the store registers so it can refresh in-memory settings after a pull. */
let onSettingsPulled: (() => void) | null = null;
export function setOnSettingsPulled(fn: (() => void) | null): void {
  onSettingsPulled = fn;
}

async function pushAll(): Promise<{ ok: boolean; error?: string }> {
  if (!getStoredToken()) return { ok: false, error: "no_token" };

  const payload: Record<string, Array<{ syncId: string; data: AnyRow; updatedAt: number; deleted: boolean }>> = {};
  let totalDirty = 0;

  for (const key of TABLES) {
    const t = tableFor(key);
    const dirty = await (t as any).where("dirty").equals(1).toArray();
    if (dirty.length === 0) continue;
    payload[key] = dirty.map((row: any) => ({
      syncId: row.syncId,
      data: row,
      updatedAt: row.updatedAt ?? Date.now(),
      deleted: !!row.deleted,
    }));
    totalDirty += dirty.length;
  }

  if (totalDirty === 0) return { ok: true };

  try {
    const res = await fetch(`${API}/api/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) { clearSession(); return { ok: false, error: "unauthorized" }; }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    // Mark every pushed row clean.
    setSyncBypass(true);
    try {
      for (const key of TABLES) {
        const items = payload[key] || [];
        for (const item of items) {
          await (tableFor(key) as any).where("syncId").equals(item.syncId).modify({ dirty: 0 });
        }
      }
    } finally {
      setSyncBypass(false);
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "network_error" };
  }
}

async function pullAll(): Promise<{ ok: boolean; error?: string; settingsTouched?: boolean }> {
  if (!getStoredToken()) return { ok: false, error: "no_token" };

  const since = Number(localStorage.getItem(LAST_PULLED_KEY) || 0);

  try {
    const res = await fetch(`${API}/api/sync/pull?since=${since}`, {
      headers: authHeaders(),
    });
    if (res.status === 401) { clearSession(); return { ok: false, error: "unauthorized" }; }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = (await res.json()) as PullResponse;
    if (!json.ok) return { ok: false, error: json.error || "pull_failed" };

    let settingsTouched = false;
    setSyncBypass(true);
    try {
      for (const key of TABLES) {
        const items = (json as any)[key] as PullItem[] | undefined;
        if (!items || items.length === 0) continue;
        const t = tableFor(key);
        for (const item of items) {
          const existing = await (t as any).where("syncId").equals(item.syncId).first();
          if (existing && (existing.updatedAt ?? 0) > item.updatedAt) {
            // Local has a strictly newer write — keep it; we'll push it next round.
            continue;
          }
          const row: any = {
            ...item.data,
            syncId: item.syncId,
            updatedAt: item.updatedAt,
            deleted: item.deleted ? 1 : 0,
            dirty: 0,
          };
          if (existing && existing.id != null) {
            row.id = existing.id;
          } else if (key === "settings") {
            row.id = SETTINGS_ID;
          } else {
            delete row.id;
          }
          await (t as any).put(row);
          if (key === "settings") settingsTouched = true;
        }
      }
    } finally {
      setSyncBypass(false);
    }

    localStorage.setItem(LAST_PULLED_KEY, String(json.serverTime));
    return { ok: true, settingsTouched };
  } catch (err: any) {
    return { ok: false, error: err?.message || "network_error" };
  }
}

/**
 * Run one push+pull cycle. Returns success flags for diagnostics. Safe to
 * call concurrently — the inner guard makes a second concurrent call a no-op.
 */
export async function syncNow(): Promise<{ pushed: boolean; pulled: boolean; error?: string }> {
  if (syncInFlight) return { pushed: false, pulled: false };
  if (!getStoredToken()) return { pushed: false, pulled: false, error: "no_token" };
  syncInFlight = true;
  try {
    const push = await pushAll();
    const pull = await pullAll();
    if (pull.settingsTouched && onSettingsPulled) {
      try { onSettingsPulled(); } catch { /* swallow — UI will re-render anyway */ }
    }
    return {
      pushed: push.ok,
      pulled: pull.ok,
      error: push.error || pull.error,
    };
  } finally {
    syncInFlight = false;
  }
}

let intervalHandle: number | null = null;
let listenersInstalled = false;
const onFocus = () => { void syncNow(); };
const onOnline = () => { void syncNow(); };

/**
 * Kick off the periodic sync loop. Idempotent — calling it twice is a no-op.
 * Fires an immediate sync, then every `intervalMs` (default 30s), plus on
 * window focus and `online` events.
 */
export function startBackgroundSync(intervalMs = 30_000): void {
  if (intervalHandle != null) return;
  void syncNow();
  intervalHandle = window.setInterval(() => { void syncNow(); }, intervalMs);
  if (!listenersInstalled) {
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    listenersInstalled = true;
  }
}

/** Stop the periodic sync loop and detach listeners. Used on logout. */
export function stopBackgroundSync(): void {
  if (intervalHandle != null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (listenersInstalled) {
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
    listenersInstalled = false;
  }
}
