import React, { useState } from "react";
import { useUI } from "../store";
import MarksheetPreview from "./MarksheetPreview";
import CertificatePreview from "./CertificatePreview";
import { IconPrinter, IconSliders } from "./Icons";
import PrintSettings from "./PrintSettings";
import { exportActiveDocumentAsPdf } from "../printing";

/** Right-pane preview + scale & print controls. */
export default function PreviewPanel() {
  const doc = useUI((s) => s.doc);
  const draft = useUI((s) => s.draft);
  const settings = useUI((s) => s.settings);

  const [scale, setScale] = useState(0.62);
  const [showSettings, setShowSettings] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const wrapperStyle: React.CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    width: `calc(210mm * ${scale})`,
    height: `calc(297mm * ${scale})`,
  };

  const PreviewComponent = doc === "marksheet" ? MarksheetPreview : CertificatePreview;

  const onPrint = () => {
    // The PrintStage rendered at root level (see App.tsx) is what actually goes
    // to the printer; @media print hides the rest of the UI.
    window.print();
  };

  const onPdf = async () => {
    setPdfBusy(true);
    try {
      await exportActiveDocumentAsPdf({
        doc,
        record: draft,
        settings,
      });
    } catch (err) {
      console.error("PDF export failed", err);
      alert("Could not export PDF: " + (err as Error).message);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] text-ink-500">
          <span className="chip">A4 Live Preview</span>
          <span className="hidden sm:inline">210 × 297 mm</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            Print mode: <strong className="text-ink-800">{settings.printMode === "preprinted" ? "Pre-printed sheet" : "Full print"}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ZoomControl scale={scale} setScale={setScale} />
          <button className="btn-secondary" onClick={() => setShowSettings((v) => !v)} title="Print mode &amp; alignment">
            <IconSliders size={16} /> Calibrate
          </button>
          <button className="btn-secondary" onClick={onPdf} disabled={pdfBusy} title="Generate a real A4 PDF">
            {pdfBusy ? "Generating…" : "Save PDF"}
          </button>
          <button className="btn-primary" onClick={onPrint}>
            <IconPrinter size={16} /> Print
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="card p-4">
          <PrintSettings />
        </div>
      )}

      <div className="card flex-1 overflow-auto p-6">
        <div style={wrapperStyle}>
          {/* IMPORTANT: no `printActive` here — the screen preview is for screen only.
              The print/PDF output uses the off-screen PrintStage rendered in App.tsx. */}
          <PreviewComponent record={draft} settings={settings} />
        </div>
      </div>

      <p className="text-[11px] text-ink-400">
        <strong>Print:</strong> sends the A4 stage directly to the printer or "Save as PDF" destination.
        For physical pre-printed sheets, switch to <em>Pre-printed Sheet</em> mode — only the text prints.
        <strong> Save PDF:</strong> always produces a real A4 PDF regardless of the browser dialog.
      </p>
    </div>
  );
}

function ZoomControl({ scale, setScale }: { scale: number; setScale: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-1 text-xs">
      <button className="rounded px-2 py-1 hover:bg-ink-100" onClick={() => setScale(Math.max(0.3, +(scale - 0.1).toFixed(2)))}>−</button>
      <span className="w-12 text-center text-ink-600">{Math.round(scale * 100)}%</span>
      <button className="rounded px-2 py-1 hover:bg-ink-100" onClick={() => setScale(Math.min(1.4, +(scale + 0.1).toFixed(2)))}>+</button>
    </div>
  );
}
