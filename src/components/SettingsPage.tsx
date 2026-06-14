import React, { useState, useEffect } from "react";
import { useUI } from "../store";
import { CERTIFICATE_FIELDS, MARKSHEET_FIELDS, MARKSHEET_TABLE_COLUMNS } from "../positions";
import type { LineOffsets } from "../types";

/** Full Settings page — print mode, per-document calibration, registration year, serial counter. */
export default function SettingsPage() {
  const settings = useUI((s) => s.settings);
  const patch = useUI((s) => s.patchSettings);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">Printing, calibration, and serial counters. All values persist locally.</p>
      </header>

      <section className="card p-5">
        <SectionHeader title="Print mode" hint="Choose how documents are sent to the printer." />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeButton
            active={settings.printMode === "full"}
            onClick={() => patch({ printMode: "full" })}
            title="Full Print"
            sub="Print the template background + the data (plain paper)."
          />
          <ModeButton
            active={settings.printMode === "preprinted"}
            onClick={() => patch({ printMode: "preprinted" })}
            title="Pre-printed Sheet"
            sub="Print only the data text onto a physical pre-printed certificate."
          />
        </div>
      </section>

      <section className="card p-5">
        <SectionHeader title="Alignment offsets" hint="Nudge the overlay in millimetres to match your physical sheet." />
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-700">Statement of Marks</h4>
            <Slider label="X offset (mm)" value={settings.marksheetOffsetX} onChange={(v) => patch({ marksheetOffsetX: v })} />
            <Slider label="Y offset (mm)" value={settings.marksheetOffsetY} onChange={(v) => patch({ marksheetOffsetY: v })} />
            <button
              className="btn-ghost mt-1 text-[11px]"
              onClick={() => patch({ marksheetOffsetX: 0, marksheetOffsetY: 0 })}
            >
              Reset marksheet
            </button>
          </div>
          <div>
            <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-ink-700">Certificate</h4>
            <Slider label="X offset (mm)" value={settings.certificateOffsetX} onChange={(v) => patch({ certificateOffsetX: v })} />
            <Slider label="Y offset (mm)" value={settings.certificateOffsetY} onChange={(v) => patch({ certificateOffsetY: v })} />
            <button
              className="btn-ghost mt-1 text-[11px]"
              onClick={() => patch({ certificateOffsetX: 0, certificateOffsetY: 0 })}
            >
              Reset certificate
            </button>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <SectionHeader
          title="Per-line calibration"
          hint="Fine-tune each individual line. These add to the global offsets above."
        />
        <p className="mt-1 text-[12px] text-ink-500">
          Use this when the lines on your physical pre-printed sheet are not evenly spaced —
          nudge each field individually so the data lands exactly on its colon.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <LineOffsetTable
            title="Statement of Marks"
            fields={MARKSHEET_FIELDS}
            offsets={settings.marksheetLineOffsets}
            onChange={(next) => patch({ marksheetLineOffsets: next })}
          />
          <LineOffsetTable
            title="Certificate"
            fields={CERTIFICATE_FIELDS}
            offsets={settings.certificateLineOffsets}
            onChange={(next) => patch({ certificateLineOffsets: next })}
          />
        </div>
      </section>

      <section className="card p-5">
        <SectionHeader
          title="Table column calibration"
          hint="Nudge each marksheet column independently. Sibling columns stay put."
        />
        <p className="mt-1 text-[12px] text-ink-500">
          Use this when a single column on your physical pre-printed sheet is shifted relative to the
          others (e.g. the Max Marks column lands 1 mm too far left). The offset only moves that
          column's text inside every row — totals and the rest of the page are unaffected.
        </p>
        <div className="mt-4">
          <LineOffsetTable
            title="Marksheet — subject table columns"
            fields={MARKSHEET_TABLE_COLUMNS}
            offsets={settings.marksheetLineOffsets}
            onChange={(next) => patch({ marksheetLineOffsets: next })}
          />
        </div>
      </section>

      <section className="card p-5">
        <SectionHeader
          title="Certificate verification QR"
          hint="Encodes a fixed verification URL. Same on every certificate."
        />
        <p className="mt-1 text-[12px] text-ink-500">
          Encodes <code className="rounded bg-ink-100 px-1.5 py-0.5">https://riteindia.org/certificate-verification/</code>
          {" "}(error-correction level H). Nudge it to sit perfectly below the printed
          "Seal of RITE COMPUTER EDUCATION" line, then choose a size that fits the gap.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Slider label="X offset (mm)" value={settings.qrOffsetX} onChange={(v) => patch({ qrOffsetX: v })} />
          <Slider label="Y offset (mm)" value={settings.qrOffsetY} onChange={(v) => patch({ qrOffsetY: v })} />
          <QrSizeSlider
            label="Size (mm)"
            value={settings.qrSizeMm}
            onChange={(v) => patch({ qrSizeMm: v })}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className="btn-ghost text-[11px]"
            onClick={() => patch({ qrOffsetX: 0, qrOffsetY: 0, qrSizeMm: 22 })}
          >
            Reset to defaults (size 22 mm, no offset)
          </button>
        </div>
      </section>

      <section className="card p-5">
        <SectionHeader title="Shared serial counter" hint="Next two values from this counter are assigned to a new record's Certificate and Marksheet (+2 per save)." />
        <NumberSetting
          label="Next serial number"
          value={settings.nextSerial}
          onSave={(v) => patch({ nextSerial: v })}
          hint={(v) => `Next certificate gets ${v}, its marksheet gets ${v + 1}.`}
        />
      </section>

      <section className="card p-5">
        <SectionHeader title="Registration number" hint="Auto-format: RITE-{year}-{####}" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberSetting
            label="Year"
            value={settings.regYear}
            onSave={(v) => patch({ regYear: v })}
          />
          <NumberSetting
            label="Next sequence"
            value={settings.nextRegSeq}
            onSave={(v) => patch({ nextRegSeq: v })}
            hint={(v) => `Next auto-generated reg no will be RITE-${settings.regYear}-${String(v).padStart(4, "0")}.`}
          />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
    </header>
  );
}

function ModeButton({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border-2 p-4 text-left transition",
        active ? "border-brand-500 bg-brand-50 shadow-pop" : "border-ink-200 bg-white hover:border-ink-300",
      ].join(" ")}
    >
      <div className={["text-sm font-semibold", active ? "text-brand-700" : "text-ink-900"].join(" ")}>{title}</div>
      <div className="mt-1 text-[12px] text-ink-500">{sub}</div>
    </button>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[12px] text-ink-600">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(1)} mm</span>
      </div>
      <input type="range" min={-10} max={10} step={0.1} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <input
        type="number"
        step={0.1}
        className="input mt-1 text-right text-[12px]"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function QrSizeSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[12px] text-ink-600">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(1)} mm</span>
      </div>
      <input type="range" min={10} max={60} step={0.5} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <input
        type="number"
        step={0.5}
        min={5}
        max={80}
        className="input mt-1 text-right text-[12px]"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function LineOffsetTable({
  title, fields, offsets, onChange,
}: {
  title: string;
  fields: { key: string; label: string }[];
  offsets: LineOffsets;
  onChange: (next: LineOffsets) => void;
}) {
  const setVal = (key: string, axis: "x" | "y", v: number) => {
    const existing = offsets[key] ?? { x: 0, y: 0 };
    const next: LineOffsets = { ...offsets, [key]: { ...existing, [axis]: v } };
    // Strip empty entries so JSON stays tidy.
    if (next[key].x === 0 && next[key].y === 0) delete next[key];
    onChange(next);
  };
  const resetAll = () => onChange({});

  return (
    <div className="rounded-xl border border-ink-200 bg-white">
      <header className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <h4 className="text-[12px] font-semibold uppercase tracking-wider text-ink-700">{title}</h4>
        <button className="text-[11px] font-semibold text-brand-600 hover:underline" onClick={resetAll}>
          Reset all
        </button>
      </header>
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-ink-400">
          <tr>
            <th className="px-3 py-1.5 text-left">Field</th>
            <th className="w-24 px-3 py-1.5 text-right">X (mm)</th>
            <th className="w-24 px-3 py-1.5 text-right">Y (mm)</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => {
            const o = offsets[f.key] ?? { x: 0, y: 0 };
            return (
              <tr key={f.key} className="border-t border-ink-50">
                <td className="px-3 py-1.5 text-[12px] text-ink-700">{f.label}</td>
                <td className="px-3 py-1">
                  <input
                    type="number"
                    step={0.1}
                    className={`input text-right ${o.x !== 0 ? "ring-1 ring-brand-300" : ""}`}
                    value={o.x}
                    onChange={(e) => setVal(f.key, "x", parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td className="px-3 py-1">
                  <input
                    type="number"
                    step={0.1}
                    className={`input text-right ${o.y !== 0 ? "ring-1 ring-brand-300" : ""}`}
                    value={o.y}
                    onChange={(e) => setVal(f.key, "y", parseFloat(e.target.value) || 0)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NumberSetting({ label, value, onSave, hint }: {
  label: string; value: number; onSave: (n: number) => void; hint?: (v: number) => string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const dirty = draft !== value && Number.isFinite(draft) && draft >= 0;
  return (
    <div className="mt-3">
      <div className="field-label">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          className="input flex-1"
          value={draft}
          onChange={(e) => setDraft(parseInt(e.target.value, 10) || 0)}
        />
        <button className="btn-primary" disabled={!dirty} onClick={() => onSave(draft)}>Save</button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-ink-400">{hint(draft)}</p>}
    </div>
  );
}
