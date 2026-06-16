import Dexie, { type Table } from "dexie";
import type {
  AppSettings,
  CourseMaster,
  SimpleKind,
  SimpleMasterValue,
  StudentRecord,
} from "./types";

/**
 * Sync engine guard. While `sync.ts` is applying rows pulled from the server,
 * it flips this on so the Dexie hooks below DON'T re-bump `updatedAt` or
 * re-mark the row dirty — otherwise every pull would immediately schedule
 * another push of the same data.
 */
let syncBypass = false;
export function setSyncBypass(v: boolean): void { syncBypass = v; }

/** Stable, cross-device syncId for default-seeded simpleMaster rows. */
function seedSyncId(kind: string, value: string): string {
  return `seed:${kind}:${value}`;
}

const DEFAULT_GRADES    = ["Excellent", "Very Good", "Satisfactory", "Fail"];
const DEFAULT_DURATIONS = ["1 Month", "3 Months", "6 Months", "9 Months", "12 Months", "1 Year"];
const DEFAULT_CENTRES   = ["RITE Computer Education, Palwal (HR.)"];

function isSeedDefault(kind: string, value: string): boolean {
  if (kind === "grade")    return DEFAULT_GRADES.includes(value);
  if (kind === "duration") return DEFAULT_DURATIONS.includes(value);
  if (kind === "centre")   return DEFAULT_CENTRES.includes(value);
  return false;
}

/**
 * Local IndexedDB store, now sync-aware.
 *
 * Tables:
 *  • students      — every saved candidate (one record powers BOTH documents).
 *  • settings      — single-row table for print mode, calibration offsets, serial counter, etc.
 *  • courses       — master courses (each with its own list of modules + subjects + max marks).
 *  • simpleMaster  — single-value master entries (durations, centres, grades).
 *
 * v4 adds sync metadata (syncId / updatedAt / deleted / dirty) on every row;
 * Dexie hooks stamp it automatically. The matching backend tables live in
 * Postgres and are reached via /api/sync/pull and /api/sync/push.
 */
class RiteDB extends Dexie {
  students!: Table<StudentRecord, number>;
  settings!: Table<AppSettings, number>;
  courses!: Table<CourseMaster, number>;
  simpleMaster!: Table<SimpleMasterValue, number>;

  constructor() {
    super("rite-doc-studio");

    // v1 — initial schema.
    this.version(1).stores({
      students: "++id, registrationNo, nameOfCandidate, updatedAt",
      settings: "++id",
    });

    // v2 — courses + simpleMaster; certificate/marksheet serials.
    this.version(2)
      .stores({
        students: "++id, registrationNo, nameOfCandidate, updatedAt",
        settings: "++id",
        courses: "++id, &name",
        simpleMaster: "++id, kind, [kind+value]",
      })
      .upgrade(async (tx) => {
        await tx
          .table("students")
          .toCollection()
          .modify((s: any) => {
            s.certificateSNo = s.certificateSNo ?? s.sNo ?? "";
            s.marksheetSNo = s.marksheetSNo ?? "";
            s.grade = s.grade ?? "";
            s.photo = s.photo ?? "";
            delete s.sNo;
          });
        const setting = await tx.table("settings").get(SETTINGS_ID);
        if (setting && setting.nextSerial == null) {
          setting.nextSerial = 1000;
          await tx.table("settings").put(setting);
        }
      });

    // v3 — courses get nested modules; settings get per-line calibration maps.
    this.version(3)
      .stores({
        students: "++id, registrationNo, nameOfCandidate, updatedAt",
        settings: "++id",
        courses: "++id, &name",
        simpleMaster: "++id, kind, [kind+value]",
      })
      .upgrade(async (tx) => {
        // Wrap any flat `subjects` array under a single "default" module.
        await tx
          .table("courses")
          .toCollection()
          .modify((c: any) => {
            if (Array.isArray(c.modules)) return;
            const subjects = Array.isArray(c.subjects) ? c.subjects : [];
            c.modules = subjects.length
              ? [{ id: rng(), name: "General", subjects }]
              : [];
            delete c.subjects;
          });
        const setting = await tx.table("settings").get(SETTINGS_ID);
        if (setting) {
          setting.marksheetLineOffsets = setting.marksheetLineOffsets ?? {};
          setting.certificateLineOffsets = setting.certificateLineOffsets ?? {};
          await tx.table("settings").put(setting);
        }
      });

    // v4 — multi-device sync metadata on every syncable row.
    this.version(4)
      .stores({
        students:     "++id, registrationNo, nameOfCandidate, updatedAt, syncId, dirty, deleted",
        settings:     "++id, syncId",
        courses:      "++id, &name, syncId, dirty, deleted",
        simpleMaster: "++id, kind, [kind+value], syncId, dirty, deleted",
      })
      .upgrade(async (tx) => {
        const now = Date.now();
        const stamp = (r: any, syncId: string) => {
          if (!r.syncId)             r.syncId    = syncId;
          if (r.updatedAt == null)   r.updatedAt = now;
          if (r.deleted == null)     r.deleted   = 0;
          if (r.dirty == null)       r.dirty     = 1;   // push existing rows on first sync.
        };
        await tx.table("students").toCollection().modify((r: any) => stamp(r, rng()));
        await tx.table("courses").toCollection().modify((r: any) => stamp(r, rng()));
        await tx.table("simpleMaster").toCollection().modify((r: any) =>
          stamp(r, isSeedDefault(r.kind, r.value) ? seedSyncId(r.kind, r.value) : rng()),
        );
        await tx.table("settings").toCollection().modify((r: any) => stamp(r, "settings-main"));
      });

    // ── Hooks ─────────────────────────────────────────────────────────
    // Stamp sync metadata on every local create/update so the next push
    // picks the row up. Skipped while sync.ts is applying pulled rows
    // (see `setSyncBypass`).
    const stampCreate = (obj: any, fixedSyncId?: string) => {
      if (syncBypass) return;
      if (!obj.syncId)         obj.syncId    = fixedSyncId ?? rng();
      if (obj.updatedAt == null) obj.updatedAt = Date.now();
      if (obj.deleted == null)   obj.deleted   = 0;
      obj.dirty = 1;
    };
    const stampUpdate = (mods: any) => {
      if (syncBypass) return undefined;
      return { ...mods, updatedAt: Date.now(), dirty: 1 };
    };
    this.students.hook("creating",     (_pk, obj: any) => { stampCreate(obj); });
    this.students.hook("updating",     (mods: any) => stampUpdate(mods));
    this.courses.hook("creating",      (_pk, obj: any) => { stampCreate(obj); });
    this.courses.hook("updating",      (mods: any) => stampUpdate(mods));
    this.simpleMaster.hook("creating", (_pk, obj: any) => { stampCreate(obj); });
    this.simpleMaster.hook("updating", (mods: any) => stampUpdate(mods));
    this.settings.hook("creating",     (_pk, obj: any) => { stampCreate(obj, "settings-main"); });
    this.settings.hook("updating",     (mods: any) => stampUpdate(mods));
  }
}

/** Tiny migration-safe id generator (avoids importing utils.ts inside Dexie callback). */
function rng() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const db = new RiteDB();

export const SETTINGS_ID = 1;

export async function loadSettings(): Promise<AppSettings> {
  const existing = await db.settings.get(SETTINGS_ID);
  if (existing) {
    const patched: AppSettings = {
      printMode: existing.printMode ?? "full",
      marksheetOffsetX: existing.marksheetOffsetX ?? 0,
      marksheetOffsetY: existing.marksheetOffsetY ?? 0,
      certificateOffsetX: existing.certificateOffsetX ?? 0,
      certificateOffsetY: existing.certificateOffsetY ?? 0,
      nextRegSeq: existing.nextRegSeq ?? 1,
      regYear: existing.regYear ?? new Date().getFullYear(),
      nextSerial: existing.nextSerial ?? 1000,
      marksheetLineOffsets: existing.marksheetLineOffsets ?? {},
      certificateLineOffsets: existing.certificateLineOffsets ?? {},
      qrOffsetX: existing.qrOffsetX ?? 0,
      qrOffsetY: existing.qrOffsetY ?? 0,
      qrSizeMm: existing.qrSizeMm ?? 22,
      id: SETTINGS_ID,
      syncId: existing.syncId ?? "settings-main",
      updatedAt: existing.updatedAt ?? Date.now(),
      deleted: existing.deleted ?? 0,
      dirty: existing.dirty ?? 0,
    };
    if (JSON.stringify(patched) !== JSON.stringify(existing)) {
      // Cosmetic patch (filling defaults) — don't churn dirty / updatedAt.
      setSyncBypass(true);
      try { await db.settings.put(patched); } finally { setSyncBypass(false); }
    }
    return patched;
  }
  const fresh: AppSettings = {
    id: SETTINGS_ID,
    printMode: "full",
    marksheetOffsetX: 0,
    marksheetOffsetY: 0,
    certificateOffsetX: 0,
    certificateOffsetY: 0,
    nextRegSeq: 1,
    regYear: new Date().getFullYear(),
    nextSerial: 1000,
    marksheetLineOffsets: {},
    certificateLineOffsets: {},
    qrOffsetX: 0,
    qrOffsetY: 0,
    qrSizeMm: 22,
    syncId: "settings-main",
    updatedAt: Date.now(),
    deleted: 0,
    dirty: 1,
  };
  await db.settings.put(fresh);
  return fresh;
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await db.settings.put({ ...s, id: SETTINGS_ID });
}

export async function reserveSerials(want: { certificate: boolean; marksheet: boolean }): Promise<{
  certificate: string;
  marksheet: string;
}> {
  return db.transaction("rw", db.settings, async () => {
    const s = (await db.settings.get(SETTINGS_ID))!;
    const out = { certificate: "", marksheet: "" };
    let next = s.nextSerial ?? 1000;
    if (want.certificate) { out.certificate = String(next); next += 1; }
    if (want.marksheet)   { out.marksheet   = String(next); next += 1; }
    await db.settings.put({ ...s, nextSerial: next, id: SETTINGS_ID });
    return out;
  });
}

/**
 * Seed sensible defaults AND dedupe any duplicate rows from earlier sessions.
 *
 * Wrapped in a single `rw` transaction so React StrictMode's double-invocation
 * can't race two concurrent seed passes.
 *
 * Seeded defaults are inserted with stable syncIds (e.g. `seed:grade:Excellent`)
 * so every device produces the SAME canonical row — first sync collapses
 * duplicate seeds into one row server-side.
 */
export async function seedMasterDefaults(): Promise<void> {
  return db.transaction("rw", db.simpleMaster, async () => {
    // ---- Dedupe pass: keep the lowest-id row per (kind, value), delete the rest.
    const all = await db.simpleMaster.toArray();
    const seen = new Set<string>();
    const toDelete: number[] = [];
    for (const row of all) {
      const key = `${row.kind}::${row.value}`;
      if (seen.has(key)) {
        if (row.id != null) toDelete.push(row.id);
      } else {
        seen.add(key);
      }
    }
    if (toDelete.length) await db.simpleMaster.bulkDelete(toDelete);

    // ---- Seed missing defaults (only those whose (kind, value) isn't present).
    const toAdd: SimpleMasterValue[] = [];
    for (const v of DEFAULT_GRADES)    if (!seen.has(`grade::${v}`))    toAdd.push({ kind: "grade",    value: v, syncId: seedSyncId("grade",    v) });
    for (const v of DEFAULT_DURATIONS) if (!seen.has(`duration::${v}`)) toAdd.push({ kind: "duration", value: v, syncId: seedSyncId("duration", v) });
    for (const v of DEFAULT_CENTRES)   if (!seen.has(`centre::${v}`))   toAdd.push({ kind: "centre",   value: v, syncId: seedSyncId("centre",   v) });
    if (toAdd.length) await db.simpleMaster.bulkAdd(toAdd);
  });
}

export async function addSimpleMaster(kind: SimpleKind, value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) return;
  const dup = await db.simpleMaster
    .where("[kind+value]").equals([kind, trimmed])
    .first();
  if (dup) {
    // Revive a previously soft-deleted row instead of leaving it hidden.
    if (dup.deleted && dup.id != null) await db.simpleMaster.update(dup.id, { deleted: 0 });
    return;
  }
  await db.simpleMaster.add({ kind, value: trimmed });
}

export async function deleteSimpleMaster(id: number): Promise<void> {
  // Soft-delete — keeps the row locally so we can push a tombstone to peers
  // and so re-adding the same kind+value revives this row instead of creating
  // a duplicate.
  await db.simpleMaster.update(id, { deleted: 1 });
}

export async function renameSimpleMaster(id: number, newValue: string): Promise<void> {
  const trimmed = newValue.trim();
  if (!trimmed) return;
  await db.simpleMaster.update(id, { value: trimmed });
}

export async function addCourse(name: string): Promise<number | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const dup = await db.courses.where("name").equalsIgnoreCase(trimmed).first();
  if (dup) {
    // Revive a previously soft-deleted course instead of hitting the &name dup index.
    if (dup.deleted && dup.id != null) await db.courses.update(dup.id, { deleted: 0 });
    return dup.id;
  }
  return (await db.courses.add({ name: trimmed, modules: [] })) as number;
}

export async function updateCourse(id: number, patch: Partial<CourseMaster>): Promise<void> {
  await db.courses.update(id, patch);
}

export async function deleteCourse(id: number): Promise<void> {
  // Soft-delete; see deleteSimpleMaster for the rationale.
  await db.courses.update(id, { deleted: 1 });
}
