import React, { useMemo } from "react";
import certBg from "../assets/certificate-template.jpeg";
import { CERTIFICATE_POS, DEFAULT_TEXT } from "../positions";
import type { AppSettings, PrintMode, StudentRecord } from "../types";
import { computeMarksSummary, displayDate } from "../utils";
import QrCode from "./QrCode";

interface Props {
  record: StudentRecord;
  settings: AppSettings;
  printMode?: PrintMode;
  printActive?: boolean;
}

export default function CertificatePreview({ record, settings, printMode, printActive }: Props) {
  const mode = printMode ?? settings.printMode;
  const summary = useMemo(() => computeMarksSummary(record.modules), [record.modules]);

  const lineOff = settings.certificateLineOffsets ?? {};

  const baseField: React.CSSProperties = {
    fontFamily: DEFAULT_TEXT.fontFamily,
    fontSize: `${DEFAULT_TEXT.fontSize}pt`,
    fontWeight: DEFAULT_TEXT.fontWeight,
    color: DEFAULT_TEXT.color,
  };

  const overlayStyle: React.CSSProperties = {
    ["--ofs-x" as any]: `${settings.certificateOffsetX}mm`,
    ["--ofs-y" as any]: `${settings.certificateOffsetY}mm`,
  };

  /** Build absolute style from a base position + a field-key (looks up per-line offset). */
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

  const grade = record.grade || summary.grade;
  const photoOff = lineOff["photo"] ?? { x: 0, y: 0 };

  return (
    <div className={`page-a4 print-area ${printActive ? (mode === "preprinted" ? "preprinted" : "") : ""}`}>
      <img className="page-a4__bg" src={certBg} alt="" draggable={false} />

      <div className="field" style={fieldStyle(CERTIFICATE_POS.sNo, "sNo", { fontSize: "11.5pt" })}>
        {record.certificateSNo}
      </div>

      {record.photo && (
        <div
          style={{
            position: "absolute",
            left: `${CERTIFICATE_POS.photo.x + photoOff.x}mm`,
            top: `${CERTIFICATE_POS.photo.y + photoOff.y}mm`,
            width: `${CERTIFICATE_POS.photo.widthMm}mm`,
            height: `${CERTIFICATE_POS.photo.heightMm}mm`,
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

      {/*
        Certificate-verification QR — always present (same fixed URL on every
        certificate). Sits BELOW the printed "Seal of RITE COMPUTER EDUCATION"
        line. Calibrated via Settings (qrOffsetX / qrOffsetY / qrSizeMm) and
        printed in the data-only print mode (it lives on the .page-a4, not on
        the hidden background template).
      */}
      <div
        style={{
          position: "absolute",
          left: `${CERTIFICATE_POS.qr.x + settings.qrOffsetX}mm`,
          top:  `${CERTIFICATE_POS.qr.y + settings.qrOffsetY}mm`,
        }}
      >
        <QrCode url={CERTIFICATE_POS.qrUrl} sizeMm={settings.qrSizeMm} />
      </div>

      <div className="page-a4__overlay" style={overlayStyle}>
        <div className="field" style={fieldStyle(CERTIFICATE_POS.registrationNo, "registrationNo")}>
          {record.registrationNo}
        </div>
        <div className="field" style={fieldStyle(CERTIFICATE_POS.nameOfCandidate, "nameOfCandidate")}>
          {record.nameOfCandidate}
        </div>
        <div className="field" style={fieldStyle(CERTIFICATE_POS.fatherName, "fatherName")}>
          {record.fatherName}
        </div>
        <div className="field" style={fieldStyle(CERTIFICATE_POS.courseName, "courseName")}>
          {record.courseName}
        </div>
        <div className="field" style={fieldStyle(CERTIFICATE_POS.duration, "duration")}>
          {record.duration}
        </div>
        <div className="field" style={fieldStyle(CERTIFICATE_POS.modulesCovered, "modulesCovered", { fontSize: "10.5pt" })}>
          {record.modulesCovered}
        </div>
        <div className="field" style={fieldStyle(CERTIFICATE_POS.authorisedTrainingCentre, "authorisedTrainingCentre")}>
          {record.authorisedTrainingCentre}
        </div>
        <div className="field" style={fieldStyle(CERTIFICATE_POS.grade, "grade", { fontWeight: 700 })}>
          {grade}
        </div>
        <div className="field" style={fieldStyle(CERTIFICATE_POS.issuedDate, "issuedDate")}>
          {displayDate(record.issuedDate)}
        </div>
      </div>
    </div>
  );
}
