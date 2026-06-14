import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { AppSettings, DocumentKind, StudentRecord } from "./types";

/**
 * Generate a real, full-A4 PDF of the active document.
 *
 * We rely on the always-rendered PrintStage (`#print-stage-root`) in App.tsx
 * which holds a 1:1, scale(1), 210 × 297 mm rendering of the marksheet /
 * certificate sitting off-screen at `left: -10000px`. html2canvas captures
 * that node at 2× scale (~192 DPI), then jsPDF stamps the image onto an
 * A4 page with zero margins.
 */
export async function exportActiveDocumentAsPdf(args: {
  doc: DocumentKind;
  record: StudentRecord;
  settings: AppSettings;
}): Promise<void> {
  const { doc, record } = args;
  const root = document.getElementById("print-stage-root");
  if (!root) throw new Error("Print stage not found in DOM.");
  const stage = root.querySelector<HTMLElement>(".page-a4");
  if (!stage) throw new Error("A4 stage element not found.");

  // Force the stage into a renderable layout for html2canvas.
  // It's normally off-screen via `left: -10000px`; that is fine for capture
  // (the element still has real dimensions).
  const canvas = await html2canvas(stage, {
    scale: 2,                  // ≈ 192 DPI — sharp print quality
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    // Force the canvas to be exactly stage's pixel dimensions
    windowWidth: stage.offsetWidth,
    windowHeight: stage.offsetHeight,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  // Add the captured stage as a full-page image (zero margin, A4 size).
  pdf.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, "FAST");

  const baseName = doc === "marksheet" ? "marksheet" : "certificate";
  const label = (record.nameOfCandidate || "untitled").replace(/[^a-z0-9_-]+/gi, "_");
  pdf.save(`${baseName}_${label}.pdf`);
}
