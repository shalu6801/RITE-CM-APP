import React, { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useUI } from "../store";
import { IconEdit, IconPlus, IconSearch, IconTrash, IconUser } from "./Icons";

/** Left-most rail listing every saved candidate with search + edit/delete. */
export default function Sidebar() {
  const search = useUI((s) => s.search);
  const setSearch = useUI((s) => s.setSearch);
  const editingId = useUI((s) => s.editingId);
  const loadRecord = useUI((s) => s.loadRecord);
  const newRecord = useUI((s) => s.newRecord);
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
        r.registrationNo.toLowerCase().includes(q),
    );
  }, [records, search]);

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-ink-200 bg-white/70 backdrop-blur-md">
      <header className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Records</div>
          <div className="text-sm font-semibold text-ink-800">Saved candidates</div>
        </div>
        <button className="btn-primary" onClick={newRecord} title="Start a new record">
          <IconPlus size={16} /> New
        </button>
      </header>

      <div className="px-4 py-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
            <IconSearch size={16} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            placeholder="Search by name or reg. no."
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {filtered.length === 0 ? (
          <div className="m-3 rounded-xl border border-dashed border-ink-200 p-6 text-center">
            <IconUser className="mx-auto mb-2 text-ink-300" size={28} />
            <div className="text-sm font-medium text-ink-700">No candidates yet</div>
            <p className="mt-1 text-[12px] text-ink-400">
              Click <span className="font-semibold text-ink-700">New</span> to add the first record.
              Data is saved locally in your browser.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => r.id && loadRecord(r.id)}
                  className={`group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    editingId === r.id
                      ? "bg-brand-50 ring-1 ring-brand-200"
                      : "hover:bg-ink-100/70"
                  }`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-semibold text-white">
                    {initials(r.nameOfCandidate) || "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink-800">
                      {r.nameOfCandidate || <span className="text-ink-400">Untitled</span>}
                    </div>
                    <div className="truncate text-[12px] text-ink-500">
                      {r.registrationNo || "No registration #"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-400">
                      {r.courseName || "No course"} {r.duration ? `· ${r.duration}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <span
                      role="button"
                      tabIndex={0}
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (r.id) loadRecord(r.id);
                      }}
                      className="rounded-md p-1 text-ink-400 hover:bg-white hover:text-brand-600"
                    >
                      <IconEdit size={14} />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (r.id && confirm(`Delete "${r.nameOfCandidate || "this record"}"?`)) {
                          deleteRecord(r.id);
                        }
                      }}
                      className="rounded-md p-1 text-ink-400 hover:bg-white hover:text-rose-600"
                    >
                      <IconTrash size={14} />
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-ink-100 px-4 py-3 text-[11px] text-ink-400">
        {(records?.length ?? 0)} record{(records?.length ?? 0) === 1 ? "" : "s"} stored locally
      </footer>
    </aside>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
