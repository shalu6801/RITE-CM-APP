// Shared TypeScript types for the whole app.

/** A single row in the Statement of Marks subject table. */
export interface ModuleRow {
  id: string;
  subject: string;
  maxMarks: number;
  marksObtained: number;
  /** Name of the module this subject belongs to (purely informational on the marksheet). */
  moduleName?: string;
}

/** A subject + its max marks, defined under a Module. */
export interface CourseSubject {
  id: string;
  name: string;
  maxMarks: number;
}

/** A module is a group of subjects inside a Course. */
export interface CourseModule {
  id: string;
  name: string;
  subjects: CourseSubject[];
}

/**
 * Fields shared by every row that participates in the multi-device sync.
 * They're filled automatically by the Dexie hooks in db.ts — UI code never
 * sets them by hand.
 *
 *  • syncId    — stable cross-device identity (the IDB `id` is per-device).
 *  • updatedAt — last local write, ms since epoch; drives last-write-wins.
 *  • deleted   — 0 / 1 tombstone flag; soft-deleted rows are filtered out of
 *                every UI query but still pushed so other devices remove them.
 *  • dirty     — 0 / 1 "needs push" flag; set by hooks on every local write,
 *                cleared by sync.ts after a successful push.
 */
export interface SyncFields {
  syncId?: string;
  updatedAt?: number;
  deleted?: 0 | 1;
  dirty?: 0 | 1;
}

/** Master record for a Course. */
export interface CourseMaster extends SyncFields {
  id?: number;
  name: string;
  /** Modules under this course; each module has its own subjects. */
  modules: CourseModule[];
}

export type SimpleKind = "duration" | "centre" | "grade";

export interface SimpleMasterValue extends SyncFields {
  id?: number;
  kind: SimpleKind;
  value: string;
}

/** One student record. Powers BOTH the marksheet and the certificate. */
export interface StudentRecord extends SyncFields {
  id?: number;
  certificateSNo: string;
  marksheetSNo: string;
  registrationNo: string;
  nameOfCandidate: string;
  fatherName: string;
  courseName: string;
  duration: string;
  authorisedTrainingCentre: string;
  modulesCovered: string;
  modules: ModuleRow[];
  grade: string;
  photo: string;
  issuedDate: string;
  createdAt: number;
  /** Last local write — drives last-write-wins sync (overrides the optional one in SyncFields). */
  updatedAt: number;
}

export type DocumentKind = "marksheet" | "certificate";
export type PrintMode = "full" | "preprinted";

export type Page = "dashboard" | "editor" | "records" | "master" | "settings";

/** Per-field calibration nudge (mm). */
export interface LineOffset { x: number; y: number; }

/** Map of field-key → offset. */
export type LineOffsets = Record<string, LineOffset>;

export interface AppSettings extends SyncFields {
  id?: number;
  printMode: PrintMode;
  marksheetOffsetX: number;
  marksheetOffsetY: number;
  certificateOffsetX: number;
  certificateOffsetY: number;
  nextRegSeq: number;
  regYear: number;
  nextSerial: number;
  /** Per-field calibration nudges for the marksheet (in addition to the global marksheetOffset). */
  marksheetLineOffsets: LineOffsets;
  /** Per-field calibration nudges for the certificate. */
  certificateLineOffsets: LineOffsets;
  /** QR code on the certificate — X / Y nudges added to the base position. */
  qrOffsetX: number;
  qrOffsetY: number;
  /** Square QR side length in mm. */
  qrSizeMm: number;
}

export interface MarksSummary {
  totalMax: number;
  totalObtained: number;
  percentage: number;
  grade: GradeLabel;
}

export type GradeLabel = "Excellent" | "Very Good" | "Satisfactory" | "Fail" | "";
