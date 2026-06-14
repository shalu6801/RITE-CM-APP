import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useUI } from "../store";
import type { Page } from "../types";
import {
  IconCert, IconFile, IconPlus, IconSliders, IconSparkle, IconUser,
} from "./Icons";

interface Item {
  id: Page;
  label: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

interface NavRailProps {
  identity?: string | null;
  onLogout?: () => void;
}

/** Left-rail vertical navigation. Persistent across pages. */
export default function NavRail({ identity, onLogout }: NavRailProps = {}) {
  const page = useUI((s) => s.page);
  const setPage = useUI((s) => s.setPage);
  const newRecord = useUI((s) => s.newRecord);
  const settings = useUI((s) => s.settings);

  const studentCount = useLiveQuery(() => db.students.filter((r) => !r.deleted).count(), [], 0);
  const courseCount  = useLiveQuery(() => db.courses.filter((r) => !r.deleted).count(),  [], 0);

  const items: Item[] = [
    { id: "dashboard", label: "Dashboard",     icon: <IconSparkle size={18} /> },
    { id: "editor",    label: "New / Edit",    icon: <IconPlus size={18} /> },
    { id: "records",   label: "All Records",   icon: <IconUser size={18} />,  badge: <Badge value={studentCount ?? 0} /> },
    { id: "master",    label: "Master Data",   icon: <IconCert size={18} />,  badge: <Badge value={courseCount ?? 0}  /> },
    { id: "settings",  label: "Settings",      icon: <IconSliders size={18} /> },
  ];

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-ink-200 bg-gradient-to-b from-white/85 to-ink-50/60 backdrop-blur-md">
      <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-base font-bold text-white shadow-pop">
          R
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-ink-900">RITE</div>
          <div className="text-[10.5px] uppercase tracking-wider text-ink-400">CM APP</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          Workspace
        </div>
        {items.slice(0, 3).map((it) => (
          <NavButton
            key={it.id}
            active={page === it.id}
            onClick={() => {
              if (it.id === "editor" && page !== "editor") newRecord();
              setPage(it.id);
            }}
            icon={it.icon}
            label={it.label}
            badge={it.badge}
          />
        ))}

        <div className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          Configuration
        </div>
        {items.slice(3).map((it) => (
          <NavButton
            key={it.id}
            active={page === it.id}
            onClick={() => setPage(it.id)}
            icon={it.icon}
            label={it.label}
            badge={it.badge}
          />
        ))}
      </nav>

      <div className="border-t border-ink-100 px-4 py-3">
        <div className="rounded-xl bg-white p-3 shadow-soft">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Next serial</div>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="text-lg font-bold text-ink-900">{settings.nextSerial}</span>
            <button
              className="text-[11px] font-semibold text-brand-600 hover:underline"
              onClick={() => setPage("settings")}
            >
              Adjust
            </button>
          </div>
        </div>
        {identity && (
          <div className="mt-3 rounded-xl border border-ink-100 bg-white p-2">
            <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-ink-400">Signed in</div>
            <div className="truncate text-[12px] font-medium text-ink-800">{identity}</div>
            <button
              className="mt-1 text-[11px] font-semibold text-rose-600 hover:underline"
              onClick={onLogout}
            >
              Logout
            </button>
          </div>
        )}
        <div className="mt-3 text-center text-[10px] text-ink-400">Local data · Auth uses internet</div>
      </div>
    </aside>
  );
}

function NavButton({
  active, onClick, icon, label, badge,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition",
        active ? "bg-brand-600 text-white shadow-pop" : "text-ink-600 hover:bg-white hover:text-ink-900 hover:shadow-sm",
      ].join(" ")}
    >
      <span className={active ? "text-white" : "text-ink-400 group-hover:text-brand-600"}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge}
    </button>
  );
}

function Badge({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-current">
      {value}
    </span>
  );
}
