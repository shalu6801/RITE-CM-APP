import React from "react";
import { useUI } from "../store";

/** Print-mode toggle + per-document X/Y calibration sliders (mm). */
export default function PrintSettings() {
  const doc = useUI((s) => s.doc);
  const settings = useUI((s) => s.settings);
  const patch = useUI((s) => s.patchSettings);

  const isMarksheet = doc === "marksheet";
  const x = isMarksheet ? settings.marksheetOffsetX : settings.certificateOffsetX;
  const y = isMarksheet ? settings.marksheetOffsetY : settings.certificateOffsetY;

  const setX = (v: number) =>
    patch(isMarksheet ? { marksheetOffsetX: v } : { certificateOffsetX: v });
  const setY = (v: number) =>
    patch(isMarksheet ? { marksheetOffsetY: v } : { certificateOffsetY: v });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="md:col-span-1">
        <h4 className="text-[12px] font-semibold uppercase tracking-wider text-ink-600">Print mode</h4>
        <p className="mt-1 text-[11px] text-ink-400">
          Switch between printing the full template or just the text on pre-printed sheets.
        </p>
        <div className="mt-3 flex rounded-xl border border-ink-200 bg-white p-1">
          <ModeButton
            active={settings.printMode === "full"}
            onClick={() => patch({ printMode: "full" })}
            title="Full Print"
            sub="Background + data (plain paper)"
          />
          <ModeButton
            active={settings.printMode === "preprinted"}
            onClick={() => patch({ printMode: "preprinted" })}
            title="Pre-printed Sheet"
            sub="Data only (physical certificate)"
          />
        </div>
      </div>

      <div className="md:col-span-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wider text-ink-600">
          Alignment offset · <span className="text-ink-400">{isMarksheet ? "Marksheet" : "Certificate"}</span>
        </h4>
        <p className="mt-1 text-[11px] text-ink-400">
          Nudge the text overlay in millimetres to align with your physical sheet. Settings persist.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SliderRow label="X offset (mm)" value={x} setValue={setX} />
          <SliderRow label="Y offset (mm)" value={y} setValue={setY} />
        </div>
        <button
          className="btn-ghost mt-2 text-[12px]"
          onClick={() => {
            setX(0);
            setY(0);
          }}
        >
          Reset offsets
        </button>
      </div>
    </div>
  );
}

function ModeButton({
  active, onClick, title, sub,
}: {
  active: boolean; onClick: () => void; title: string; sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-left transition ${
        active ? "bg-brand-600 text-white shadow-pop" : "text-ink-600 hover:bg-ink-100"
      }`}
    >
      <div className="text-[13px] font-semibold">{title}</div>
      <div className={`text-[11px] ${active ? "text-brand-50/90" : "text-ink-400"}`}>{sub}</div>
    </button>
  );
}

function SliderRow({
  label, value, setValue,
}: { label: string; value: number; setValue: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] text-ink-600">
        <span>{label}</span>
        <span className="font-mono">{value.toFixed(1)} mm</span>
      </div>
      <input
        type="range"
        min={-10}
        max={10}
        step={0.1}
        value={value}
        onChange={(e) => setValue(parseFloat(e.target.value))}
      />
      <div className="mt-1 flex items-center gap-2">
        <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => setValue(+(value - 0.5).toFixed(1))}>− 0.5</button>
        <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => setValue(+(value + 0.5).toFixed(1))}>+ 0.5</button>
        <input
          className="input ml-auto w-24 px-2 py-1 text-right text-[12px]"
          type="number"
          step={0.1}
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
        />
      </div>
    </div>
  );
}
