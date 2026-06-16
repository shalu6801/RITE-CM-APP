/**
 * ──────────────────────────────────────────────────────────────────────────
 *  POSITIONS CONFIG  (RITE Computer Education — Document Studio)
 * ──────────────────────────────────────────────────────────────────────────
 *
 *  All coordinates are in MILLIMETRES on an A4 page (210 mm × 297 mm).
 *  (0, 0) is the TOP-LEFT corner of the page.
 *
 *  Tips for tuning:
 *    • Increase `x` to move a field RIGHT.
 *    • Increase `y` to move a field DOWN.
 *    • `fontSize` is in pt (printer points).
 *    • For the marksheet table, edit `MARKSHEET_POS.table.area` (the bounding
 *      rectangle of the data rows) and `MARKSHEET_POS.table.columns` (per-column
 *      width / alignment / padding). Rows auto-fill the area's height — there
 *      is no fixed row-height to tune.
 */

export const PAGE = { widthMm: 210, heightMm: 297 } as const;

export interface FieldPos {
  x: number;
  y: number;
  maxWidth?: number;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  align?: "left" | "center" | "right";
  color?: string;
}

export interface PhotoBox {
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
}

/**
 * Per-column configuration for the marksheet subject table.
 *  - `widthMm: null` → the column grows to fill leftover space (only one column may use this).
 *  - `align`        → horizontal text alignment.
 *  - `paddingLeftMm` / `paddingRightMm` → inner padding so text never touches the printed column lines.
 *  - `fontSize`     → optional override (otherwise inherits table.fontSize).
 *  - `fontWeight`   → optional weight override.
 */
export interface TableColumnConfig {
  key: "sno" | "subject" | "maxMarks" | "obtained";
  widthMm: number | null;
  align: "left" | "center" | "right";
  paddingLeftMm: number;
  paddingRightMm: number;
  fontSize?: number;
  fontWeight?: number;
}

export const DEFAULT_TEXT = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 11,
  fontWeight: 600,
  color: "#111111",
} as const;

// ─────────────────────────────────────────────────────────────────────
//  STATEMENT OF MARKS
// ─────────────────────────────────────────────────────────────────────
export const MARKSHEET_POS = {
  sNo:                       { x:  37,   y:  22   } as FieldPos,
  registrationNo:            { x:  77,   y:  82.5, maxWidth: 110 } as FieldPos,
  nameOfCandidate:           { x:  77,   y:  92.0, maxWidth: 110 } as FieldPos,
  courseName:                { x:  77,   y: 101.5, maxWidth: 110 } as FieldPos,
  duration:                  { x:  77,   y: 111.0, maxWidth: 110 } as FieldPos,
  authorisedTrainingCentre:  { x:  77,   y: 120.5, maxWidth: 110 } as FieldPos,

  table: {
    /** Bounding rectangle of the DATA ROWS area (between the printed header bar and the Total row). */
    area: { x: 13, y: 144.5, widthMm: 186, heightMm: 84 },
    /**
     * Per-column independent configuration.
     * Exactly one column should use widthMm: null — it stretches to take the
     * remaining width. All other columns use explicit mm widths.
     */
    columns: [
      { key: "sno",      widthMm: 16,   align: "center", paddingLeftMm: 1,   paddingRightMm: 1   },
      { key: "subject",  widthMm: null, align: "left",   paddingLeftMm: 3.5, paddingRightMm: 3.5 },
      { key: "maxMarks", widthMm: 28,   align: "center", paddingLeftMm: 1,   paddingRightMm: 1   },
      { key: "obtained", widthMm: 30,   align: "center", paddingLeftMm: 1,   paddingRightMm: 1   },
    ] as TableColumnConfig[],
    /** Default font for table cells. Long subject text auto-shrinks 1pt at a time when wrapping fails. */
    fontSize: 10.5,
    fontWeight: 600,
    /** Where the "Total" row VALUES sit (mm from page top). The label "Total" itself is pre-printed. */
    totalY: 231,
    totalMaxX: 143,
    totalObtainedX: 176,
    totalCellWidth: 30,
  },

  percentage:                { x:  44,   y: 244.5 } as FieldPos,
  grade:                     { x: 132,   y: 244.5 } as FieldPos,

  /** Candidate photo — 1.5 in × 1.5 in (38.1 mm) at the marksheet top-right. */
  photo:                     { x: 160,   y:  20,   widthMm: 38.1, heightMm: 38.1 } as PhotoBox,

  /** Issued date — sits ABOVE the pre-printed "Palwal, HR" / place line at the bottom. */
  issuedDate:                { x:  30,   y: 270,   maxWidth: 80 } as FieldPos,
} as const;

// ─────────────────────────────────────────────────────────────────────
//  CERTIFICATE OF COURSE COMPLETION
// ─────────────────────────────────────────────────────────────────────
export const CERTIFICATE_POS = {
  sNo:                       { x:  37,   y:  22.5 } as FieldPos,
  registrationNo:            { x:  77,   y:  89   , maxWidth: 110 } as FieldPos,
  nameOfCandidate:           { x:  77,   y:  98.5 , maxWidth: 110 } as FieldPos,
  fatherName:                { x:  77,   y: 108   , maxWidth: 110 } as FieldPos,
  courseName:                { x:  77,   y: 117.5 , maxWidth: 110 } as FieldPos,
  duration:                  { x:  77,   y: 127   , maxWidth: 110 } as FieldPos,
  modulesCovered:            { x:  77,   y: 136.5 , maxWidth: 110 } as FieldPos,
  authorisedTrainingCentre:  { x:  77,   y: 169   , maxWidth: 110 } as FieldPos,
  grade:                     { x:  77,   y: 178.5 , maxWidth: 110 } as FieldPos,
  issuedDate:                { x:  77,   y: 188   , maxWidth: 110 } as FieldPos,
  /** Candidate photo — 1.5 in × 1.5 in (38.1 mm), square. */
  photo:                     { x: 160,   y:  20  , widthMm: 38.1, heightMm: 38.1 } as PhotoBox,

  /**
   * Verification QR code on the certificate, sitting BELOW the "Seal of RITE
   * COMPUTER EDUCATION" line. Always encodes the same fixed URL.
   *   x, y  → top-left in mm; size is square; tunable via Settings.
   */
  qr:                        { x:  80,   y: 245,    sizeMm: 22 },

  /** URL that the QR encodes — constant on every certificate. */
  qrUrl: "https://riteindia.org/certificate-verification/",
} as const;

export const MARKSHEET_FIELDS: { key: string; label: string }[] = [
  { key: "sNo",                       label: "S. No." },
  { key: "registrationNo",            label: "Registration No." },
  { key: "nameOfCandidate",           label: "Name of Candidate" },
  { key: "courseName",                label: "On successful Completion of" },
  { key: "duration",                  label: "Duration" },
  { key: "authorisedTrainingCentre",  label: "Authorised Training Centre" },
  { key: "table",                     label: "Subject table (whole block)" },
  { key: "totalRowMax",               label: "Total — Max Marks" },
  { key: "totalRowObtained",          label: "Total — Marks Obtained" },
  { key: "percentage",                label: "Percentage" },
  { key: "grade",                     label: "Grade" },
  { key: "issuedDate",                label: "Issued Date" },
  { key: "photo",                     label: "Photo box" },
];

/**
 * Per-column calibration keys for the marksheet's subject table.
 * Each column offset only nudges THAT column's content; siblings stay put.
 */
export const MARKSHEET_TABLE_COLUMNS: { key: string; label: string; columnKey: string }[] = [
  { key: "tableColSno",      label: "S. NO. column",         columnKey: "sno" },
  { key: "tableColSubject",  label: "Subject Modules column", columnKey: "subject" },
  { key: "tableColMaxMarks", label: "Max. Marks column",      columnKey: "maxMarks" },
  { key: "tableColObtained", label: "Marks Obtained column",  columnKey: "obtained" },
];

/** Map a table-column key (used by TableColumnConfig) → the offset key in settings.marksheetLineOffsets. */
export const COLUMN_OFFSET_KEY: Record<string, string> = {
  sno:      "tableColSno",
  subject:  "tableColSubject",
  maxMarks: "tableColMaxMarks",
  obtained: "tableColObtained",
};

export const CERTIFICATE_FIELDS: { key: string; label: string }[] = [
  { key: "sNo",                       label: "S. No." },
  { key: "registrationNo",            label: "Registration No." },
  { key: "nameOfCandidate",           label: "Name of Candidate" },
  { key: "fatherName",                label: "S/o D/o" },
  { key: "courseName",                label: "On successful Completion of" },
  { key: "duration",                  label: "Duration" },
  { key: "modulesCovered",            label: "Modules Covered" },
  { key: "authorisedTrainingCentre",  label: "Authorised Training Centre" },
  { key: "grade",                     label: "Grade" },
  { key: "issuedDate",                label: "Issued Date" },
  { key: "photo",                     label: "Photo box" },
];
