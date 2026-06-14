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

/** Convert a File / Blob to a base64 data URL for IndexedDB storage. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
