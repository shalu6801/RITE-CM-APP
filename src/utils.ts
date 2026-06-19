import type { GradeLabel, MarksSummary, ModuleRow, StudentRecord } from "./types";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function computeMarksSummary(modules: ModuleRow[]): MarksSummary {
  let totalMax = 0;
  let totalObtained = 0;
  for (const m of modules) {
    if (Number.isFinite(m.maxMarks)) totalMax += m.maxMarks;
    if (Number.isFinite(m.marksObtained)) totalObtained += m.marksObtained;
  }
  const percentage = totalMax > 0
    ? Math.round((totalObtained / totalMax) * 10000) / 100
    : 0;
  return { totalMax, totalObtained, percentage, grade: gradeFromPercentage(percentage, totalMax) };
}

export function gradeFromPercentage(p: number, totalMax: number): GradeLabel {
  if (totalMax <= 0) return "";
  if (p > 75) return "Excellent";
  if (p >= 51) return "Very Good";
  if (p >= 30) return "Satisfactory";
  return "Fail";
}

export function makeRegistrationNo(year: number, seq: number): string {
  return `RITE-${year}-${String(seq).padStart(4, "0")}`;
}

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function displayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

export function emptyRecord(): StudentRecord {
  const now = Date.now();
  return {
    certificateSNo: "",
    marksheetSNo: "",
    registrationNo: "",
    nameOfCandidate: "",
    fatherName: "",
    courseName: "",
    duration: "",
    authorisedTrainingCentre: "RITE Computer Education, Palwal (HR.)",
    modulesCovered: "",
    modules: [],
    grade: "",
    photo: "",
    issuedDate: todayISO(),
    createdAt: now,
    updatedAt: now,
  };
}

export function clampMarks(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (Number.isFinite(max) && value > max) return max;
  return value;
}

export function toInt(v: unknown): number {
  if (typeof v === "number") return Math.trunc(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function deriveModulesCovered(modules: ModuleRow[]): string {
  return modules
    .map((m) => m.subject.trim())
    .filter(Boolean)
    .join(", ");
}

export function sortMasterValues(kind: string, values: string[]): string[] {
  if (kind !== "duration") return values.slice().sort((a, b) => a.localeCompare(b));

  const durationRank = (value: string): number => {
    const text = value.toLowerCase().trim();
    if (/year/.test(text)) {
      const years = parseInt(text, 10);
      return Number.isFinite(years) ? years * 12 : Number.MAX_SAFE_INTEGER;
    }
    const months = parseInt(text, 10);
    return Number.isFinite(months) ? months : Number.MAX_SAFE_INTEGER;
  };

  return values.slice().sort((a, b) => {
    const byDuration = durationRank(a) - durationRank(b);
    return byDuration || a.localeCompare(b);
  });
}

/**
 * Maps a course duration string to the number of modules the marksheet should
 * use. RITE's curriculum convention:
 *
 *   • 1 Month   → 1 module
 *   • 3 Months  → 2 modules
 *   • 6 Months  → 2 modules
 *   • 9 Months  → 3 modules
 *   • 12 Months → 4 modules     (alias: "1 Year")
 *
 * Returns 0 when the duration doesn't match any known bucket — callers treat
 * 0 as "no limit" and keep every module the selected course defines.
 */
export function moduleCountForDuration(duration: string): number {
  const d = (duration || "").toLowerCase().trim();
  if (!d) return 0;
  if (/year/.test(d)) return /^1\b/.test(d) ? 4 : 0;
  const months = parseInt(d, 10);
  switch (months) {
    case 1:  return 1;
    case 3:  return 2;
    case 6:  return 2;
    case 9:  return 3;
    case 12: return 4;
    default: return 0;
  }
}

/** Convert a File / Blob to a base64 data URL for IndexedDB storage. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
