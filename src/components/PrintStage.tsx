import React from "react";
import { useUI } from "../store";
import MarksheetPreview from "./MarksheetPreview";
import CertificatePreview from "./CertificatePreview";

/**
 * Off-screen, full-size A4 render of the currently-active document.
 *
 * This component lives at the ROOT of the App (outside the scaled preview
 * pane), so it has no parent transforms. It is positioned off-screen on the
 * regular screen (CSS `.print-stage { left: -10000px }`); on `@media print`
 * the screen UI is hidden and the print stage becomes the only thing in the
 * print viewport — which lands a pixel-perfect 210 × 297 mm document on the
 * page. `Save PDF` captures this same element via html2canvas + jsPDF.
 */
export default function PrintStage() {
  const doc = useUI((s) => s.doc);
  const draft = useUI((s) => s.draft);
  const settings = useUI((s) => s.settings);

  return (
    <div id="print-stage-root" className="print-stage" aria-hidden="true">
      {doc === "marksheet" ? (
        <MarksheetPreview record={draft} settings={settings} printActive />
      ) : (
        <CertificatePreview record={draft} settings={settings} printActive />
      )}
    </div>
  );
}
