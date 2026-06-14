import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useUI } from "../store";
import type { StudentRecord } from "../types";
import { IconCert, IconFile, IconPlus, IconSparkle, IconUser } from "./Icons";

/** Welcome dashboard with quick stats + recent records + quick actions. */
export default function DashboardPage() {
  const settings = useUI((s) => s.settings);
  const setPage = useUI((s) => s.setPage);
  const newRecord = useUI((s) => s.newRecord);
  const loadRecord = useUI((s) => s.loadRecord);

  const students = useLiveQuery(
    () => db.students.orderBy("updatedAt").reverse().filter((r) => !r.deleted).toArray(),
    [],
    [],
  );
  const courseCount = useLiveQuery(() => db.courses.filter((r) => !r.deleted).count(), [], 0);

  const total = students?.length ?? 0;
  const recent = (students ?? []).slice(0, 6);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-500">
            RITE CM APP · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { newRecord(); setPage("editor"); }}
        >
          <IconPlus size={16} /> Add new candidate
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Total candidates"
          value={total}
          icon={<IconUser />}
          accent="from-brand-500 to-brand-700"
        />
        <Tile
          label="Courses defined"
          value={courseCount ?? 0}
          icon={<IconCert />}
          accent="from-emerald-500 to-emerald-700"
          onClick={() => setPage("master")}
          actionLabel="Manage →"
        />
        <Tile
          label="Next serial number"
          value={settings.nextSerial}
          icon={<IconFile />}
          accent="from-amber-500 to-amber-600"
          onClick={() => setPage("settings")}
          actionLabel="Adjust →"
        />
        <Tile
          label="Print mode"
          value={settings.printMode === "preprinted" ? "Pre-printed" : "Full print"}
          icon={<IconSparkle />}
          accent="from-fuchsia-500 to-fuchsia-700"
          onClick={() => setPage("settings")}
          actionLabel="Change →"
        />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-700">Recent candidates</h2>
          <button
            onClick={() => setPage("records")}
            className="text-[12px] font-semibold text-brand-600 hover:underline"
          >
            View all →
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="card flex flex-col items-center justify-center p-12 text-center">
            <IconUser size={36} className="mb-3 text-ink-300" />
            <h3 className="text-base font-semibold text-ink-800">No candidates yet</h3>
            <p className="mt-1 text-sm text-ink-500">Add your first candidate to get started.</p>
            <button
              className="btn-primary mt-4"
              onClick={() => { newRecord(); setPage("editor"); }}
            >
              <IconPlus size={16} /> Add new candidate
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {recent.map((r) => <RecentCard key={r.id} r={r} onOpen={async () => {
              if (r.id) { await loadRecord(r.id); setPage("editor"); }
            }} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({
  label, value, icon, accent, onClick, actionLabel,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
  onClick?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="card group relative overflow-hidden p-5">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${accent} opacity-10`} />
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white shadow-pop`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-ink-900">{value}</div>
      {onClick && (
        <button
          onClick={onClick}
          className="mt-3 text-[12px] font-semibold text-brand-600 hover:underline"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function RecentCard({ r, onOpen }: { r: StudentRecord; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="card group flex items-start gap-3 p-4 text-left transition hover:shadow-pop"
    >
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-semibold text-white">
        {initials(r.nameOfCandidate) || "—"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink-900">
          {r.nameOfCandidate || <span className="text-ink-400">Untitled</span>}
        </div>
        <div className="truncate text-[12px] text-ink-500">
          {r.registrationNo || "—"}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-400">
          <span>{r.courseName || "No course"}</span>
          <span>·</span>
          <span>Cert #{r.certificateSNo || "—"}</span>
        </div>
      </div>
    </button>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
