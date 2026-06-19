import React, { useMemo } from "react";
import marksheetBg from "../assets/marksheet-template.jpeg";
import { COLUMN_OFFSET_KEY, DEFAULT_TEXT, MARKSHEET_POS } from "../positions";
import type { TableColumnConfig } from "../positions";
import type { LineOffsets } from "../types";
import type { AppSettings, ModuleRow, PrintMode, StudentRecord } from "../types";
import { computeMarksSummary, displayDate } from "../utils";

interface Props {
  record: StudentRecord;
  settings: AppSettings;
  printMode?: PrintMode;
  printActive?: boolean;
}

export default function MarksheetPreview({ record, settings, printMode, printActive }: Props) {
  const mode = printMode ?? settings.printMode;
  const summary = useMemo(() => computeMarksSummary(record.modules), [record.modules]);

  const lineOff = settings.marksheetLineOffsets ?? {};

  const baseField: React.CSSProperties = {
    fontFamily: DEFAULT_TEXT.fontFamily,
    fontSize: `${DEFAULT_TEXT.fontSize}pt`,
    fontWeight: DEFAULT_TEXT.fontWeight,
    color: DEFAULT_TEXT.color,
  };

  const overlayStyle: React.CSSProperties = {
    ["--ofs-x" as any]: `${settings.marksheetOffsetX}mm`,
    ["--ofs-y" as any]: `${settings.marksheetOffsetY}mm`,
  };

  const fieldStyle = (
    pos: { x: number; y: number; maxWidth?: number },
    key: string,
    extra?: React.CSSProperties,
  ): React.CSSProperties => {
    const ofs = lineOff[key] ?? { x: 0, y: 0 };
    return {
      ...baseField,
      left: `${pos.x + ofs.x}mm`,
      top: `${pos.y + ofs.y}mm`,
      maxWidth: pos.maxWidth ? `${pos.maxWidth}mm` : undefined,
      ...extra,
    };
  };

  const t = MARKSHEET_POS.table;
  const tableOff = lineOff["table"] ?? { x: 0, y: 0 };
  const photoOff = lineOff["photo"] ?? { x: 0, y: 0 };
  /**
   * Two independent offsets, one per total cell — each only moves its own value.
   * Persisted under the same `marksheetLineOffsets` map as the other per-line nudges.
   */
  const totalMaxOff      = lineOff["totalRowMax"]      ?? { x: 0, y: 0 };
  const totalObtainedOff = lineOff["totalRowObtained"] ?? { x: 0, y: 0 };

  return (
    <div className={`page-a4 ${printActive ? "print-area" : ""} ${mode === "preprinted" ? "preprinted" : ""}`}>
      <img className="page-a4__bg" src={marksheetBg} alt="" draggable={false} />

      {/* Top-left S. No. — outside the calibrated body overlay. */}
      <div className="field" style={fieldStyle(MARKSHEET_POS.sNo, "sNo", { fontSize: "11.5pt" })}>
        {record.marksheetSNo}
      </div>

      {/* Candidate photo — 1.5 in × 1.5 in (38.1 mm), top-right. Outside the
          body overlay so it stays aligned with the printed template box. */}
      {record.photo && (
        <div
          style={{
            position: "absolute",
            left: `${MARKSHEET_POS.photo.x + photoOff.x}mm`,
            top: `${MARKSHEET_POS.photo.y + photoOff.y}mm`,
            width: `${MARKSHEET_POS.photo.widthMm}mm`,
            height: `${MARKSHEET_POS.photo.heightMm}mm`,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={record.photo}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
            }}
          />
        </div>
      )}

      <div className="page-a4__overlay" style={overlayStyle}>
        <div className="field" style={fieldStyle(MARKSHEET_POS.registrationNo, "registrationNo")}>
          {record.registrationNo}
        </div>
        <div className="field" style={fieldStyle(MARKSHEET_POS.nameOfCandidate, "nameOfCandidate")}>
          {record.nameOfCandidate}
        </div>
        <div className="field" style={fieldStyle(MARKSHEET_POS.courseName, "courseName")}>
          {record.courseName}
        </div>
        <div className="field" style={fieldStyle(MARKSHEET_POS.duration, "duration")}>
          {record.duration}
        </div>
        <div className="field" style={fieldStyle(MARKSHEET_POS.authorisedTrainingCentre, "authorisedTrainingCentre")}>
          {record.authorisedTrainingCentre}
        </div>

        <SubjectTable
          rows={record.modules}
          tableOffset={tableOff}
          lineOffsets={lineOff}
          areaX={t.area.x}
          areaY={t.area.y}
          areaWidthMm={t.area.widthMm}
          areaHeightMm={t.area.heightMm}
          columns={t.columns}
          fontSize={t.fontSize}
          fontWeight={t.fontWeight}
        />

        <div className="field" style={{
          ...baseField,
          left: `${t.totalMaxX + totalMaxOff.x}mm`,
          top: `${t.totalY + totalMaxOff.y}mm`,
          width: `${t.totalCellWidth}mm`,
          fontSize: `${t.fontSize}pt`,
          fontWeight: 700,
          textAlign: "center",
        }}>
          {summary.totalMax || ""}
        </div>
        <div className="field" style={{
          ...baseField,
          left: `${t.totalObtainedX + totalObtainedOff.x}mm`,
          top: `${t.totalY + totalObtainedOff.y}mm`,
          width: `${t.totalCellWidth}mm`,
          fontSize: `${t.fontSize}pt`,
          fontWeight: 700,
          textAlign: "center",
        }}>
          {summary.totalObtained || ""}
        </div>

        <div className="field" style={fieldStyle(MARKSHEET_POS.percentage, "percentage", { fontWeight: 700 })}>
          {summary.totalMax ? `${summary.percentage.toFixed(2)} %` : ""}
        </div>
        <div className="field" style={fieldStyle(MARKSHEET_POS.grade, "grade", { fontWeight: 700 })}>
          {record.grade || summary.grade}
        </div>

        {/* Issued Date — printed ABOVE the pre-printed "Palwal, HR" / place line. */}
        <div className="field" style={fieldStyle(MARKSHEET_POS.issuedDate, "issuedDate")}>
          {record.issuedDate ? displayDate(record.issuedDate) : ""}
        </div>
      </div>
    </div>
  );
}

/**
 * Flex-driven subject table. Rows share the available area height equally
 * (`flex: 1 1 0`) so 3 rows fill the area the same way 8 do — no big empty
 * gap at the bottom. Rows never overlap because they stack as flex siblings.
 * Long subject text wraps inside its cell via `overflowWrap: anywhere`.
 */
function SubjectTable({
  rows, tableOffset, lineOffsets, areaX, areaY, areaWidthMm, areaHeightMm, columns, fontSize, fontWeight,
}: {
  rows: ModuleRow[];
  tableOffset: { x: number; y: number };
  lineOffsets: LineOffsets;
  areaX: number;
  areaY: number;
  areaWidthMm: number;
  areaHeightMm: number;
  columns: readonly TableColumnConfig[];
  fontSize: number;
  fontWeight: number;
}) {
  /** Per-column offset lookup (sticks to the column, leaves siblings alone). */
  const colOff = (key: string) => lineOffsets[COLUMN_OFFSET_KEY[key] ?? ""] ?? { x: 0, y: 0 };
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: `${areaX + tableOffset.x}mm`,
    top:  `${areaY + tableOffset.y}mm`,
    width:  `${areaWidthMm}mm`,
    height: `${areaHeightMm}mm`,
    display: "flex",
    flexDirection: "column",
    fontFamily: DEFAULT_TEXT.fontFamily,
    color: DEFAULT_TEXT.color,
    fontSize: `${fontSize}pt`,
    fontWeight,
    lineHeight: 1.25,
  };

  if (rows.length === 0) return <div style={containerStyle} />;

  // Group rows by moduleName in their original order. Each group renders as
  // a bold module-name header row followed by its subject rows. Subjects
  // entered manually (no moduleName) fall into a single anonymous bucket
  // that renders without a header — keeps the legacy flat-list behaviour.
  const groups: Array<{ moduleName: string; rows: ModuleRow[] }> = [];
  const groupIndex = new Map<string, number>();
  for (const row of rows) {
    const key = row.moduleName?.trim() ?? "";
    let idx = groupIndex.get(key);
    if (idx === undefined) {
      idx = groups.length;
      groupIndex.set(key, idx);
      groups.push({ moduleName: key, rows: [] });
    }
    groups[idx].rows.push(row);
  }
  const totalRows = groups.length + rows.length;

  const dynamicFontPt =
    totalRows >= 14 ? Math.max(8, fontSize - 1.5) :
    totalRows >= 11 ? Math.max(8.5, fontSize - 1) :
    fontSize;
  const displayFontPt = Math.min(dynamicFontPt + 1, 11.5);
  const lineStyle: React.CSSProperties = { minHeight: "4mm", lineHeight: 1.15 };

  // Rows take their natural content height instead of stretching to fill
  // the whole 84mm area. With `flex: 1 1 0` (the old behaviour) every row
  // expanded equally, so 4 subjects produced 20mm-tall rows with the text
  // floating in the middle — visually a giant gap between subjects. Natural
  // height + a sensible minHeight gives a compact, readable table.
  const flexRow: React.CSSProperties = {
    flex: "1 1 0",
    minHeight: "14mm",
    display: "flex",
    alignItems: "stretch",
    overflow: "hidden",
  };

  let moduleSno = 0;
  const elements: React.ReactNode[] = [];
  for (const group of groups) {
    if (group.moduleName) {
      moduleSno++;
    }
    const hasModuleHeading = Boolean(group.moduleName);
    elements.push(
      <div key={`module-${group.moduleName || group.rows.map((r) => r.id).join("-")}`} style={flexRow}>
        <Cell col={columns[0]} columnOffset={colOff(columns[0].key)} fontSizePt={displayFontPt} top>
          {group.moduleName ? `${moduleSno}.` : ""}
        </Cell>
        <Cell col={columns[1]} columnOffset={colOff(columns[1].key)} fontSizePt={displayFontPt} top>
          <div>
            {group.moduleName && <div style={{ ...lineStyle, fontWeight: 700 }}>{group.moduleName}:</div>}
            {group.rows.map((row) => (
              <div key={row.id} style={lineStyle}>{row.subject}</div>
            ))}
          </div>
        </Cell>
        <Cell col={columns[2]} columnOffset={colOff(columns[2].key)} fontSizePt={displayFontPt} top>
          <div>
            {hasModuleHeading && <div style={lineStyle} />}
            {group.rows.map((row) => (
              <div key={row.id} style={lineStyle}>{row.maxMarks || ""}</div>
            ))}
          </div>
        </Cell>
        <Cell col={columns[3]} columnOffset={colOff(columns[3].key)} fontSizePt={displayFontPt} top>
          <div>
            {hasModuleHeading && <div style={lineStyle} />}
            {group.rows.map((row) => (
              <div key={row.id} style={lineStyle}>{Number.isFinite(row.marksObtained) ? row.marksObtained : ""}</div>
            ))}
          </div>
        </Cell>
      </div>,
    );
  }

  return <div style={containerStyle}>{elements}</div>;
}

function Cell({
  col, fontSizePt, columnOffset, children, bold, top,
}: {
  col: TableColumnConfig;
  fontSizePt: number;
  columnOffset?: { x: number; y: number };
  children?: React.ReactNode;
  /** Forces fontWeight to 700 — used by the module-name header rows. */
  bold?: boolean;
  top?: boolean;
}) {
  const ofs = columnOffset && (columnOffset.x || columnOffset.y) ? columnOffset : null;
  const style: React.CSSProperties = {
    flex: col.widthMm == null ? "1 1 0" : `0 0 ${col.widthMm}mm`,
    paddingLeft: `${col.paddingLeftMm}mm`,
    paddingRight: `${col.paddingRightMm}mm`,
    textAlign: col.align,
    fontSize: col.fontSize ? `${col.fontSize}pt` : `${fontSizePt}pt`,
    fontWeight: bold ? 700 : col.fontWeight,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    whiteSpace: "normal",
    boxSizing: "border-box",
    display: "flex",
    alignItems: top ? "flex-start" : "center",
    justifyContent: col.align === "center" ? "center" : col.align === "right" ? "flex-end" : "flex-start",
    transform: ofs ? `translate(${ofs.x}mm, ${ofs.y}mm)` : undefined,
    // Subject column gets double line-spacing so wrapped subject text is
    // readable without compressing into the next row. Other columns keep
    // the table-default 1.25 so the page layout is undisturbed.
    // Subject column gets a 1.3 line-height — readable for wrapped subject
    // names without adding visible gap. Other columns inherit the
    // table-default 1.25.
    lineHeight: col.key === "subject" ? 1.3 : undefined,
  };
  return <div style={style}>{children}</div>;
}
