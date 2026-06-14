import { create } from "zustand";
import type {
  AppSettings,
  DocumentKind,
  ModuleRow,
  Page,
  SimpleKind,
  StudentRecord,
} from "./types";
import {
  addCourse,
  addSimpleMaster,
  db,
  loadSettings,
  reserveSerials,
  saveSettings,
  seedMasterDefaults,
  SETTINGS_ID,
} from "./db";
import { computeMarksSummary, emptyRecord, makeRegistrationNo, uid } from "./utils";

interface UIState {
  draft: StudentRecord;
  editingId: number | undefined;
  doc: DocumentKind;
  settings: AppSettings;
  ready: boolean;
  search: string;

  /** Current page shown by the App shell. */
  page: Page;
  masterDataFocusCourseId: number | null;

  init: () => Promise<void>;
  /** Re-hydrate the in-memory settings from IndexedDB. Called by sync.ts after a pull. */
  reloadSettings: () => Promise<void>;

  setDoc: (d: DocumentKind) => void;
  setSearch: (s: string) => void;

  /** Navigate to a top-level page (Dashboard, Records, Editor, Master Data, Settings). */
  setPage: (page: Page, focusCourseId?: number | null) => void;

  setDraft: <K extends keyof StudentRecord>(key: K, value: StudentRecord[K]) => void;
  updateModule: (id: string, patch: Partial<ModuleRow>) => void;
  addModule: () => void;
  removeModule: (id: string) => void;
  newRecord: () => void;
  loadRecord: (id: number) => Promise<void>;
  autoFillModulesCovered: () => void;
  autogenerateRegNo: () => Promise<void>;
  /** Pick a course from master data — auto-populates marksheet rows + modulesCovered. */
  selectCourse: (courseName: string) => Promise<void>;
  setPhoto: (dataUrl: string) => void;
  clearPhoto: () => void;

  saveDraft: () => Promise<number>;
  deleteRecord: (id: number) => Promise<void>;

  patchSettings: (patch: Partial<AppSettings>) => Promise<void>;

  addCourseMaster: (name: string) => Promise<number | undefined>;
  addSimple: (kind: SimpleKind, value: string) => Promise<void>;

  recomputeGrade: () => void;
}

export const useUI = create<UIState>((set, get) => ({
  draft: emptyRecord(),
  editingId: undefined,
  doc: "marksheet",
  settings: {
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
  },
  ready: false,
  search: "",
  page: "dashboard",
  masterDataFocusCourseId: null,

  async init() {
    const settings = await loadSettings();
    await seedMasterDefaults();
    set({ settings, ready: true });
  },

  async reloadSettings() {
    const settings = await loadSettings();
    set({ settings });
  },

  setDoc(d) { set({ doc: d }); },
  setSearch(s) { set({ search: s }); },

  setPage(page, focusCourseId = null) {
    set({ page, masterDataFocusCourseId: focusCourseId });
  },

  setDraft(key, value) {
    set((state) => ({ draft: { ...state.draft, [key]: value, updatedAt: Date.now() } }));
  },

  updateModule(id, patch) {
    set((state) => {
      const modules = state.draft.modules.map((m) => (m.id === id ? { ...m, ...patch } : m));
      const summary = computeMarksSummary(modules);
      return {
        draft: {
          ...state.draft,
          modules,
          grade: summary.grade || state.draft.grade,
          updatedAt: Date.now(),
        },
      };
    });
  },
  addModule() {
    set((state) => ({
      draft: {
        ...state.draft,
        modules: [
          ...state.draft.modules,
          { id: uid(), subject: "", maxMarks: 100, marksObtained: 0 },
        ],
        updatedAt: Date.now(),
      },
    }));
  },
  removeModule(id) {
    set((state) => {
      const modules = state.draft.modules.filter((m) => m.id !== id);
      const summary = computeMarksSummary(modules);
      return {
        draft: {
          ...state.draft,
          modules,
          grade: summary.grade,
          updatedAt: Date.now(),
        },
      };
    });
  },

  newRecord() {
    set({ draft: emptyRecord(), editingId: undefined });
  },

  async loadRecord(id) {
    const rec = await db.students.get(id);
    if (rec) set({ draft: rec, editingId: rec.id });
  },

  autoFillModulesCovered() {
    set((state) => ({
      draft: {
        ...state.draft,
        modulesCovered: state.draft.modules
          .map((m) => m.subject.trim())
          .filter(Boolean)
          .join(", "),
        updatedAt: Date.now(),
      },
    }));
  },

  async autogenerateRegNo() {
    const { settings } = get();
    const next = makeRegistrationNo(settings.regYear, settings.nextRegSeq);
    set((state) => ({ draft: { ...state.draft, registrationNo: next } }));
  },

  async selectCourse(courseName) {
    set((state) => ({ draft: { ...state.draft, courseName, updatedAt: Date.now() } }));
    const course = await db.courses.where("name").equalsIgnoreCase(courseName).first();
    const allSubjects = (course?.modules ?? []).flatMap((mod) =>
      mod.subjects.map((sub) => ({ ...sub, moduleName: mod.name })),
    );
    if (!course || allSubjects.length === 0) return;

    const existing = get().draft.modules;
    const hasData = existing.some((m) => m.subject.trim() || m.marksObtained > 0);
    if (hasData) {
      const ok = window.confirm(
        `This will replace the current modules table with the ${allSubjects.length} subjects defined for "${course.name}". Continue?`,
      );
      if (!ok) return;
    }

    const rows: ModuleRow[] = allSubjects.map((s) => ({
      id: uid(),
      subject: s.name,
      maxMarks: s.maxMarks,
      marksObtained: 0,
      moduleName: s.moduleName,
    }));
    // Certificate's "Modules Covered" lists the SUBJECT names from every module
    // (matches what the "Auto-fill from modules table" button produces too).
    const modulesCovered = allSubjects.map((s) => s.name).filter(Boolean).join(", ");
    set((state) => ({
      draft: { ...state.draft, modules: rows, modulesCovered, updatedAt: Date.now() },
    }));
  },

  setPhoto(dataUrl) { set((state) => ({ draft: { ...state.draft, photo: dataUrl, updatedAt: Date.now() } })); },
  clearPhoto() { set((state) => ({ draft: { ...state.draft, photo: "", updatedAt: Date.now() } })); },

  recomputeGrade() {
    set((state) => {
      const summary = computeMarksSummary(state.draft.modules);
      return { draft: { ...state.draft, grade: summary.grade } };
    });
  },

  async saveDraft() {
    const state = get();
    const now = Date.now();
    let payload: StudentRecord = { ...state.draft, updatedAt: now };
    if (!payload.createdAt) payload.createdAt = now;

    // Assign serials when missing (a "document is generated" the first time it's saved).
    const need = {
      certificate: !payload.certificateSNo,
      marksheet: !payload.marksheetSNo,
    };
    if (need.certificate || need.marksheet) {
      const reserved = await reserveSerials(need);
      payload = {
        ...payload,
        certificateSNo: payload.certificateSNo || reserved.certificate,
        marksheetSNo: payload.marksheetSNo || reserved.marksheet,
      };
      const refreshed = await loadSettings();
      set({ settings: refreshed });
    }

    let id: number;
    if (state.editingId != null) {
      payload.id = state.editingId;
      await db.students.put(payload);
      id = state.editingId;
    } else {
      id = (await db.students.add(payload)) as number;
      const expected = makeRegistrationNo(state.settings.regYear, state.settings.nextRegSeq);
      if (payload.registrationNo === expected) {
        const updated = { ...get().settings, nextRegSeq: state.settings.nextRegSeq + 1 };
        await saveSettings(updated);
        set({ settings: updated });
      }
    }
    set({ editingId: id, draft: { ...payload, id } });
    return id;
  },

  async deleteRecord(id) {
    // Soft-delete: keeps the row in IndexedDB with deleted=1 so the next sync
    // pushes a tombstone to other devices. UI queries filter `deleted` rows out.
    await db.students.update(id, { deleted: 1 });
    if (get().editingId === id) set({ draft: emptyRecord(), editingId: undefined });
  },

  async patchSettings(patch) {
    const merged = { ...get().settings, ...patch };
    await saveSettings(merged);
    set({ settings: merged });
  },

  async addCourseMaster(name) {
    return addCourse(name);
  },
  async addSimple(kind, value) {
    await addSimpleMaster(kind, value);
  },
}));
