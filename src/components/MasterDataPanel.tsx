import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  addCourse,
  addSimpleMaster,
  db,
  deleteCourse,
  deleteSimpleMaster,
  renameSimpleMaster,
  updateCourse,
} from "../db";
import type { CourseMaster, CourseModule, CourseSubject, SimpleKind, SimpleMasterValue } from "../types";
import { useUI } from "../store";
import { sortMasterValues, uid } from "../utils";
import { IconPlus, IconTrash } from "./Icons";

const KIND_LABELS: Record<SimpleKind, { label: string; placeholder: string; hint: string }> = {
  duration: { label: "Durations",        placeholder: "e.g. 6 Months",          hint: "Course durations shown in the Duration dropdown." },
  centre:   { label: "Training Centres", placeholder: "Centre name + location", hint: "Authorised Training Centre options." },
  grade:    { label: "Grades",           placeholder: "e.g. Excellent",         hint: "Grade options. Auto-grade still works; this is for manual overrides." },
};

type Tab = "courses" | "serial" | SimpleKind;

const TABS: { id: Tab; label: string }[] = [
  { id: "courses",   label: "Courses & subjects" },
  { id: "duration",  label: "Durations" },
  { id: "centre",    label: "Centres" },
  { id: "grade",     label: "Grades" },
  { id: "serial",    label: "Serial number" },
];

/**
 * Master Data page.
 * Tabs along the top let you manage courses (with nested subjects),
 * simple dropdown values (durations / centres / grades / modules-covered),
 * and the shared serial counter.
 */
export default function MasterDataPage() {
  const focusCourseId = useUI((s) => s.masterDataFocusCourseId);
  const [tab, setTab] = useState<Tab>("courses");

  useEffect(() => {
    if (focusCourseId != null) setTab("courses");
  }, [focusCourseId]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Master data</h1>
        <p className="mt-1 text-sm text-ink-500">
          Courses, dropdown values and the shared serial counter all live here. Stored locally — never uploaded.
        </p>
      </header>

      <div className="card p-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-ink-50 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "rounded-md px-3 py-1.5 text-[13px] font-medium transition",
                tab === t.id ? "bg-white text-brand-700 shadow-sm" : "text-ink-600 hover:bg-white/60",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5">
        {tab === "courses" && <CoursesEditor focusCourseId={focusCourseId} />}
        {tab === "serial" && <SerialEditor />}
        {(tab === "duration" || tab === "centre" || tab === "grade") && (
          <SimpleListEditor kind={tab} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Courses (with nested subjects)
// ─────────────────────────────────────────────────────────────────────
function CoursesEditor({ focusCourseId }: { focusCourseId: number | null }) {
  const courses = useLiveQuery(() => db.courses.orderBy("name").filter((r) => !r.deleted).toArray(), [], []);
  const [selectedId, setSelectedId] = useState<number | null>(focusCourseId);
  const [newName, setNewName] = useState("");

  // Auto-select a focused or first course.
  useEffect(() => {
    if (focusCourseId != null) { setSelectedId(focusCourseId); return; }
    if (selectedId == null && (courses?.length ?? 0) > 0 && courses![0].id != null) {
      setSelectedId(courses![0].id!);
    }
  }, [focusCourseId, courses, selectedId]);

  const selected = (courses ?? []).find((c) => c.id === selectedId) ?? null;

  const handleAddCourse = async () => {
    const id = await addCourse(newName);
    setNewName("");
    if (id != null) setSelectedId(id);
  };

  return (
    <div className="flex h-[60vh] gap-5">
      <div className="flex w-64 shrink-0 flex-col rounded-xl border border-ink-200 bg-white">
        <header className="border-b border-ink-100 p-3">
          <div className="flex gap-2">
            <input
              className="input"
              value={newName}
              placeholder="New course name…"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCourse()}
            />
            <button className="btn-primary" onClick={handleAddCourse} aria-label="Add course">
              <IconPlus size={16} />
            </button>
          </div>
        </header>
        <ul className="flex-1 overflow-auto p-2">
          {(courses ?? []).length === 0 && (
            <li className="px-2 py-6 text-center text-[12px] text-ink-400">
              No courses yet. Add one above to start defining subjects.
            </li>
          )}
          {(courses ?? []).map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelectedId(c.id!)}
                className={[
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                  selectedId === c.id ? "bg-brand-50 text-brand-800" : "hover:bg-ink-50",
                ].join(" ")}
              >
                <span className="truncate">{c.name}</span>
                <span className="ml-2 shrink-0 text-[11px] text-ink-400">
                  {c.modules?.length ?? 0} mod.
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white p-4">
        {selected ? (
          <CourseDetail
            key={selected.id}
            course={selected}
            onDelete={async () => {
              if (confirm(`Delete course "${selected.name}"?`)) {
                await deleteCourse(selected.id!);
                setSelectedId(null);
              }
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-400">
            Select a course on the left, or add a new one.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Editor for one Course → its Modules → each module's Subjects.
 * Course "Diploma in Computer Apps" → Module "Theory" → Subjects { MS Word: 100, MS Excel: 100, … }
 *                                  → Module "Practical" → Subjects { Typing: 50, … }
 */
function CourseDetail({ course, onDelete }: { course: CourseMaster; onDelete: () => void }) {
  const [draftName, setDraftName] = useState(course.name);
  const [modules, setModules] = useState<CourseModule[]>(course.modules ?? []);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraftName(course.name);
    setModules(course.modules ?? []);
    setDirty(false);
  }, [course.id]);

  const save = async () => {
    await updateCourse(course.id!, { name: draftName.trim() || course.name, modules });
    setDirty(false);
  };

  const addModule = () => {
    setModules((m) => [...m, { id: uid(), name: "", subjects: [] }]);
    setDirty(true);
  };
  const removeModule = (id: string) => {
    if (!confirm("Delete this module and its subjects?")) return;
    setModules((m) => m.filter((x) => x.id !== id));
    setDirty(true);
  };
  const updateModule = (id: string, patch: Partial<CourseModule>) => {
    setModules((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const addSubject = (moduleId: string) => {
    setModules((m) =>
      m.map((x) =>
        x.id === moduleId
          ? { ...x, subjects: [...x.subjects, { id: uid(), name: "", maxMarks: 100 }] }
          : x,
      ),
    );
    setDirty(true);
  };
  const updateSubject = (moduleId: string, subjId: string, patch: Partial<CourseSubject>) => {
    setModules((m) =>
      m.map((x) =>
        x.id === moduleId
          ? { ...x, subjects: x.subjects.map((s) => (s.id === subjId ? { ...s, ...patch } : s)) }
          : x,
      ),
    );
    setDirty(true);
  };
  const removeSubject = (moduleId: string, subjId: string) => {
    setModules((m) =>
      m.map((x) =>
        x.id === moduleId
          ? { ...x, subjects: x.subjects.filter((s) => s.id !== subjId) }
          : x,
      ),
    );
    setDirty(true);
  };

  const totalSubjects = modules.reduce((a, b) => a + b.subjects.length, 0);
  const totalMax = modules.reduce(
    (a, b) => a + b.subjects.reduce((s, sub) => s + (Number.isFinite(sub.maxMarks) ? sub.maxMarks : 0), 0),
    0,
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <input
          className="input flex-1 text-base font-semibold"
          value={draftName}
          onChange={(e) => { setDraftName(e.target.value); setDirty(true); }}
        />
        <button className="btn-danger" onClick={onDelete}>
          <IconTrash size={14} /> Delete course
        </button>
      </div>

      <div className="flex items-baseline justify-between">
        <div>
          <h4 className="text-[12px] font-semibold uppercase tracking-wider text-ink-700">Modules &amp; subjects</h4>
          <p className="text-[11px] text-ink-400">
            Selecting this course on a student record auto-fills the marksheet with every subject from every module,
            and the certificate's <em>Modules Covered</em> line with the module names.
          </p>
        </div>
        <div className="text-[11px] text-ink-400">
          {modules.length} module{modules.length === 1 ? "" : "s"} · {totalSubjects} subject{totalSubjects === 1 ? "" : "s"} · Total max {totalMax}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-auto pr-1">
        {modules.length === 0 && (
          <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/50 p-8 text-center text-sm text-ink-500">
            No modules yet. Click <span className="font-semibold">Add module</span> below to create one
            (e.g. <em>Theory</em>, <em>Practical</em>), then add its subjects.
          </div>
        )}

        {modules.map((mod, mi) => {
          const modMax = mod.subjects.reduce((a, s) => a + (Number.isFinite(s.maxMarks) ? s.maxMarks : 0), 0);
          return (
            <div key={mod.id} className="rounded-xl border border-ink-200 bg-white">
              <header className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/40 px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                  {mi + 1}
                </span>
                <input
                  className="input flex-1"
                  value={mod.name}
                  placeholder="Module name (e.g. Theory, Practical)"
                  onChange={(e) => updateModule(mod.id, { name: e.target.value })}
                />
                <span className="chip">Max {modMax}</span>
                <button
                  className="rounded-md p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => removeModule(mod.id)}
                  title="Remove module"
                >
                  <IconTrash size={16} />
                </button>
              </header>
              <div className="px-3 py-2">
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-ink-400">
                    <tr>
                      <th className="w-10 py-1 text-left">#</th>
                      <th className="py-1 text-left">Subject</th>
                      <th className="w-28 py-1 text-right">Max marks</th>
                      <th className="w-10 py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {mod.subjects.length === 0 && (
                      <tr><td colSpan={4} className="py-3 text-center text-[12px] text-ink-400">
                        No subjects under this module yet.
                      </td></tr>
                    )}
                    {mod.subjects.map((sub, si) => (
                      <tr key={sub.id} className="border-t border-ink-50">
                        <td className="py-1.5 text-[12px] text-ink-500">{si + 1}</td>
                        <td className="py-1.5 pr-2">
                          <input
                            className="input"
                            value={sub.name}
                            placeholder="e.g. MS Word"
                            onChange={(e) => updateSubject(mod.id, sub.id, { name: e.target.value })}
                          />
                        </td>
                        <td className="py-1.5">
                          <input
                            className="input text-right"
                            type="number"
                            min={0}
                            value={Number.isFinite(sub.maxMarks) ? sub.maxMarks : 0}
                            onChange={(e) => updateSubject(mod.id, sub.id, { maxMarks: parseInt(e.target.value, 10) || 0 })}
                          />
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            className="rounded-md p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => removeSubject(mod.id, sub.id)}
                            title="Remove subject"
                          >
                            <IconTrash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="btn-ghost mt-2 text-[12px]" onClick={() => addSubject(mod.id)}>
                  <IconPlus size={14} /> Add subject to this module
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button className="btn-secondary" onClick={addModule}>
          <IconPlus size={16} /> Add module
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-[12px] ${dirty ? "text-amber-600" : "text-ink-400"}`}>
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button className="btn-primary" onClick={save} disabled={!dirty}>
            Save course
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Simple master CRUD (durations / centres / grades / modulesCovered)
// ─────────────────────────────────────────────────────────────────────
function SimpleListEditor({ kind }: { kind: SimpleKind }) {
  const items = useLiveQuery(
    () => db.simpleMaster.where("kind").equals(kind).filter((r) => !r.deleted).toArray(),
    [kind],
    [],
  );
  const sortedValues = sortMasterValues(kind, (items ?? []).map((item) => item.value));
  const sorted = sortedValues
    .map((value) => (items ?? []).find((item) => item.value === value))
    .filter((item): item is SimpleMasterValue => Boolean(item));
  const [newValue, setNewValue] = useState("");
  const meta = KIND_LABELS[kind];

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    await addSimpleMaster(kind, newValue);
    setNewValue("");
  };

  return (
    <div className="flex h-[60vh] flex-col">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-ink-900">{meta.label}</h3>
        <p className="text-[12px] text-ink-400">{meta.hint}</p>
      </header>

      <div className="mb-3 flex gap-2">
        <input
          className="input"
          value={newValue}
          placeholder={meta.placeholder}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button className="btn-primary" onClick={handleAdd} disabled={!newValue.trim()}>
          <IconPlus size={16} /> Add
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-ink-200 bg-white">
        {sorted.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-400">
            Nothing here yet. Add the first value above.
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {sorted.map((v) => (
              <li key={v.id} className="flex items-center gap-2 px-3 py-2">
                <input
                  defaultValue={v.value}
                  className="input flex-1"
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== v.value && v.id != null) renameSimpleMaster(v.id, next);
                  }}
                />
                <button
                  className="rounded-md p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => v.id != null && deleteSimpleMaster(v.id)}
                  title="Delete"
                >
                  <IconTrash size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
//  Serial number editor
// ─────────────────────────────────────────────────────────────────────
function SerialEditor() {
  const settings = useUI((s) => s.settings);
  const patch = useUI((s) => s.patchSettings);
  const [draft, setDraft] = useState(settings.nextSerial);

  useEffect(() => { setDraft(settings.nextSerial); }, [settings.nextSerial]);

  return (
    <div className="space-y-5">
      <header>
        <h3 className="text-sm font-semibold text-ink-900">Shared serial counter</h3>
        <p className="text-[12px] text-ink-400">
          Every time you save a new student record, the next two serial numbers from this counter are assigned —
          one to the Certificate, one to the Marksheet — and the counter increments by 2. Edit carefully:
          changing this affects future records only; serials already assigned do not change.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-ink-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <div className="field-label">Next serial</div>
          <input
            type="number"
            className="input text-right text-lg font-semibold"
            value={draft}
            onChange={(e) => setDraft(parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div className="col-span-2 flex items-end">
          <button
            className="btn-primary"
            disabled={draft === settings.nextSerial || draft < 0}
            onClick={() => patch({ nextSerial: draft })}
          >
            Update counter
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">
        <strong>Tip:</strong> the counter starts at 1000 by default. The next certificate gets <code>{draft}</code>,
        its marksheet gets <code>{draft + 1}</code>, and the counter advances to <code>{draft + 2}</code>.
      </div>
    </div>
  );
}
