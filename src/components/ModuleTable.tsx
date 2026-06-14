import React from "react";
import { useUI } from "../store";
import { clampMarks, computeMarksSummary, toInt } from "../utils";
import { IconPlus, IconTrash } from "./Icons";

/** Editable subject modules table used by the marksheet form. */
export default function ModuleTable() {
  const modules = useUI((s) => s.draft.modules);
  const updateModule = useUI((s) => s.updateModule);
  const addModule = useUI((s) => s.addModule);
  const removeModule = useUI((s) => s.removeModule);

  const summary = computeMarksSummary(modules);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-800">Subject Modules</h3>
          <p className="text-[12px] text-ink-500">
            Add the modules that appear in the marksheet. Total &amp; grade auto-update.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={addModule}>
          <IconPlus size={16} /> Add module
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
            <tr>
              <th className="w-10 px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Subject Module</th>
              <th className="w-24 px-2 py-2 text-right">Max</th>
              <th className="w-24 px-2 py-2 text-right">Obtained</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {modules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-ink-400">
                  No modules yet — click <span className="font-medium">Add module</span> to begin.
                </td>
              </tr>
            )}
            {modules.map((m, idx) => {
              const invalid = m.marksObtained > m.maxMarks;
              return (
                <tr key={m.id} className="border-t border-ink-100">
                  <td className="px-2 py-2 text-ink-500">{idx + 1}</td>
                  <td className="px-2 py-2">
                    <input
                      className="input"
                      value={m.subject}
                      placeholder="e.g. MS Word"
                      onChange={(e) => updateModule(m.id, { subject: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className="input text-right"
                      type="number"
                      min={0}
                      value={Number.isFinite(m.maxMarks) ? m.maxMarks : 0}
                      onChange={(e) => {
                        const newMax = toInt(e.target.value);
                        updateModule(m.id, {
                          maxMarks: newMax,
                          marksObtained: clampMarks(m.marksObtained, newMax),
                        });
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      className={`input text-right ${invalid ? "border-rose-400 focus:ring-rose-300/40" : ""}`}
                      type="number"
                      min={0}
                      value={Number.isFinite(m.marksObtained) ? m.marksObtained : 0}
                      onChange={(e) =>
                        updateModule(m.id, { marksObtained: clampMarks(toInt(e.target.value), m.maxMarks) })
                      }
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                      onClick={() => removeModule(m.id)}
                      title="Remove row"
                    >
                      <IconTrash size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-ink-50/60">
            <tr className="border-t border-ink-200 text-sm">
              <td className="px-2 py-2 text-ink-500"></td>
              <td className="px-2 py-2 font-semibold text-ink-700">Total</td>
              <td className="px-2 py-2 text-right font-semibold">{summary.totalMax}</td>
              <td className="px-2 py-2 text-right font-semibold">{summary.totalObtained}</td>
              <td />
            </tr>
            <tr className="border-t border-ink-100 text-[12px]">
              <td colSpan={2} className="px-2 py-2 text-ink-500">
                Percentage:&nbsp;<span className="font-semibold text-ink-800">
                  {summary.totalMax ? `${summary.percentage.toFixed(2)} %` : "—"}
                </span>
              </td>
              <td colSpan={3} className="px-2 py-2 text-right text-ink-500">
                Grade:&nbsp;<span className="font-semibold text-ink-800">{summary.grade || "—"}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
