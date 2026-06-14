import React, { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useUI } from "../store";
import { IconEdit, IconPlus, IconSearch, IconTrash, IconUser } from "./Icons";

/** Full-page table of every saved student. */
export default function RecordsPage() {
  const search = useUI((s) => s.search);
  const setSearch = useUI((s) => s.setSearch);
  const setPage = useUI((s) => s.setPage);
  const newRecord = useUI((s) => s.newRecord);
  const loadRecord = useUI((s) => s.loadRecord);
  const deleteRecord = useUI((s) => s.deleteRecord);

  const records = useLiveQuery(
    () => db.students.orderBy("updatedAt").reverse().filter((r) => !r.deleted).toArray(),
    [],
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records ?? [];
    return (records ?? []).filter(
      (r) =>
        r.nameOfCandidate.toLowerCase().includes(q) ||
        r.registrationNo.toLowerCase().includes(q) ||
        r.courseName.toLowerCase().includes(q),
    );
  }, [records, search]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">All records</h1>
          <p className="mt-1 text-sm text-ink-500">
            {(records?.length ?? 0)} candidate{(records?.length ?? 0) === 1 ? "" : "s"} stored locally.
          </p>
        </div>
        <button className="btn-primary" onClick={() => { newRecord(); setPage("editor"); }}>
          <IconPlus size={16} /> New candidate
        </button>
      </header>

      <div className="card p-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
            <IconSearch size={16} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Search by name, registration no., or course"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <IconUser size={36} className="mb-3 text-ink-300" />
            <h3 className="text-base font-semibold text-ink-800">
              {search ? "No matches" : "No candidates yet"}
            </h3>
            <p className="mt-1 text-sm text-ink-500">
              {search
                ? "Try a different search term."
                : "Add a candidate to begin."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-[11px] uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left">Cert #</th>
                <th className="px-4 py-3 text-left">Marks #</th>
                <th className="px-4 py-3 text-left">Candidate</th>
                <th className="px-4 py-3 text-left">Registration No.</th>
                <th className="px-4 py-3 text-left">Course</th>
                <th className="px-4 py-3 text-left">Grade</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                  <td className="px-4 py-3 font-mono text-ink-700">{r.certificateSNo || "—"}</td>
                  <td className="px-4 py-3 font-mono text-ink-700">{r.marksheetSNo || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[10px] font-semibold text-white">
                        {initials(r.nameOfCandidate)}
                      </div>
                      <span className="font-medium text-ink-800">
                        {r.nameOfCandidate || <span className="text-ink-400">Untitled</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{r.registrationNo || "—"}</td>
                  <td className="px-4 py-3 text-ink-600">{r.courseName || "—"}</td>
                  <td className="px-4 py-3">
                    {r.grade ? (
                      <span className="chip bg-emerald-100 text-emerald-700">{r.grade}</span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-500">
                    {new Date(r.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="rounded-md p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-700"
                        onClick={async () => { if (r.id != null) { await loadRecord(r.id); setPage("editor"); } }}
                        title="Edit"
                      >
                        <IconEdit size={16} />
                      </button>
                      <button
                        className="rounded-md p-1.5 text-ink-500 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => {
                          if (r.id != null && confirm(`Delete "${r.nameOfCandidate || "this record"}"?`)) {
                            deleteRecord(r.id);
                          }
                        }}
                        title="Delete"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
