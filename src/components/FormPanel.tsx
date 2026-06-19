import React, { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { useUI } from "../store";
import type { SimpleKind } from "../types";
import { computeMarksSummary, sortMasterValues } from "../utils";
import Combobox from "./Combobox";
import ModuleTable from "./ModuleTable";
import PhotoField from "./PhotoField";
import { IconRefresh, IconSparkle } from "./Icons";

/**
 * Left-pane form. Every change immediately updates the live preview on the right.
 * Fields are grouped into sectioned cards for readability.
 */
export default function FormPanel() {
  const draft = useUI((s) => s.draft);
  const doc = useUI((s) => s.doc);
  const editingId = useUI((s) => s.editingId);
  const settings = useUI((s) => s.settings);
  const setDraft = useUI((s) => s.setDraft);
  const autoFillModulesCovered = useUI((s) => s.autoFillModulesCovered);
  const autogenerateRegNo = useUI((s) => s.autogenerateRegNo);
  const selectCourse = useUI((s) => s.selectCourse);
  const selectDuration = useUI((s) => s.selectDuration);
  const setPhoto = useUI((s) => s.setPhoto);
  const clearPhoto = useUI((s) => s.clearPhoto);
  const setPage = useUI((s) => s.setPage);
  const addCourseMaster = useUI((s) => s.addCourseMaster);
  const addSimple = useUI((s) => s.addSimple);

  // Live master data feeds the Comboboxes.
  const courses   = useLiveQuery(() => db.courses.orderBy("name").filter((r) => !r.deleted).toArray(), [], []);
  const durations = useSimpleList("duration");
  const centres   = useSimpleList("centre");
  const grades    = useSimpleList("grade");

  const courseNames = useMemo(() => (courses ?? []).map((c) => c.name), [courses]);

  const summary = useMemo(() => computeMarksSummary(draft.modules), [draft.modules]);

  /** True when the picked course exists in master but has no subjects defined yet. */
  const selectedCourseEmpty = useMemo(() => {
    if (!draft.courseName) return false;
    const course = (courses ?? []).find((c) => c.name.toLowerCase() === draft.courseName.toLowerCase());
    const totalSubjects = (course?.modules ?? []).reduce((a, m) => a + (m.subjects?.length ?? 0), 0);
    return !!course && totalSubjects === 0;
  }, [courses, draft.courseName]);

  const selectedCourseId = useMemo(() => {
    const course = (courses ?? []).find((c) => c.name.toLowerCase() === draft.courseName.toLowerCase());
    return course?.id ?? null;
  }, [courses, draft.courseName]);

  // Next-serial preview when this is a brand-new record.
  const nextCertSno = !editingId && !draft.certificateSNo ? String(settings.nextSerial) : draft.certificateSNo;
  const nextMarkSno = !editingId && !draft.marksheetSNo
    ? String(settings.nextSerial + (draft.certificateSNo ? 0 : 1))
    : draft.marksheetSNo;

  return (
    <div className="space-y-5">
      <Section title="Document serial numbers" hint="Auto-assigned from the shared counter on first save.">
        <div className="grid grid-cols-12 gap-3">
          <Field label="Certificate S. No." span={6}>
            <input
              className="input bg-ink-50 font-semibold"
              value={nextCertSno}
              readOnly={!editingId}
              onChange={(e) => setDraft("certificateSNo", e.target.value)}
              placeholder="Auto"
              title={!editingId ? "Will be assigned on save" : "Override only if you really mean it"}
            />
          </Field>
          <Field label="Marksheet S. No." span={6}>
            <input
              className="input bg-ink-50 font-semibold"
              value={nextMarkSno}
              readOnly={!editingId}
              onChange={(e) => setDraft("marksheetSNo", e.target.value)}
              placeholder="Auto"
            />
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-ink-400">
          Next counter value:&nbsp;<strong className="text-ink-700">{settings.nextSerial}</strong>.
          <button className="ml-2 text-brand-600 hover:underline" onClick={() => setPage("settings")}>
            Manage counter →
          </button>
        </p>
      </Section>

      <Section title="Candidate identity" hint="Shared between the marksheet and the certificate.">
        <div className="grid grid-cols-12 gap-3">
          <Field
            label="Registration No."
            span={12}
            right={
              <button
                type="button"
                className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 hover:underline"
                onClick={autogenerateRegNo}
                title="Auto-generate next Registration No."
              >
                <IconSparkle size={14} className="-mt-0.5 mr-1 inline-block" />
                Auto-generate
              </button>
            }
          >
            <input
              className="input"
              value={draft.registrationNo}
              placeholder="RITE-2026-0001"
              onChange={(e) => setDraft("registrationNo", e.target.value)}
            />
          </Field>
          <Field label="Name of Candidate" span={12}>
            <input
              className="input"
              value={draft.nameOfCandidate}
              placeholder="Full name as it should appear on the certificate"
              onChange={(e) => setDraft("nameOfCandidate", e.target.value)}
            />
          </Field>
          <Field label="S/o D/o (Father / Guardian)" span={12}>
            <input
              className="input"
              value={draft.fatherName}
              placeholder="Father's or guardian's name (Certificate only)"
              onChange={(e) => setDraft("fatherName", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Course details" hint="Picking a course auto-fills the marksheet table.">
        <div className="grid grid-cols-12 gap-3">
          <Field
            label="On successful Completion of"
            span={8}
            right={
              selectedCourseEmpty && (
                <button
                  type="button"
                  className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 hover:underline"
                  onClick={() => setPage("master", selectedCourseId)}
                >
                  Add subjects →
                </button>
              )
            }
          >
            <Combobox
              value={draft.courseName}
              options={courseNames}
              placeholder="Pick or type a course"
              onChange={(v) => setDraft("courseName", v)}
              onPick={(v) => selectCourse(v)}
              onAdd={async (v) => { await addCourseMaster(v); }}
              footer={
                <button className="text-brand-600 hover:underline" onClick={() => setPage("master")}>
                  Manage courses →
                </button>
              }
            />
          </Field>
          <Field label="Duration" span={4}>
            <Combobox
              value={draft.duration}
              options={durations}
              placeholder="Pick a duration"
              onChange={(v) => setDraft("duration", v)}
              onPick={(v) => selectDuration(v)}
              onAdd={async (v) => addSimple("duration", v)}
            />
          </Field>
          <Field label="Authorised Training Centre" span={12}>
            <Combobox
              value={draft.authorisedTrainingCentre}
              options={centres}
              placeholder="Centre name + location"
              onChange={(v) => setDraft("authorisedTrainingCentre", v)}
              onAdd={async (v) => addSimple("centre", v)}
            />
          </Field>
          <Field label="Grade (auto from marks; override below)" span={6}>
            <Combobox
              value={draft.grade || summary.grade}
              options={grades}
              placeholder="Grade"
              onChange={(v) => setDraft("grade", v)}
              onAdd={async (v) => addSimple("grade", v)}
            />
          </Field>
          <Field label="" span={6}>
            <div className="flex h-full items-center gap-2 rounded-lg border border-dashed border-ink-200 bg-ink-50/50 px-3 py-2 text-[12px] text-ink-500">
              Computed&nbsp;<strong className="text-ink-800">{summary.grade || "—"}</strong>
              {summary.totalMax > 0 && (
                <span className="ml-auto text-ink-400">{summary.percentage.toFixed(2)}%</span>
              )}
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Photo" hint="Shown on the certificate's top-right. Saved locally only.">
        <PhotoField value={draft.photo} onChange={setPhoto} onClear={clearPhoto} />
      </Section>

      {doc === "marksheet" && (
        <Section title="Marks & modules" hint="Live total, percentage and grade update as you type.">
          <ModuleTable />
        </Section>
      )}

      {doc === "certificate" && (
        <Section title="Certificate specifics" hint="Shown only on the Certificate of Completion.">
          <div className="grid grid-cols-12 gap-3">
            <Field
              label="Modules Covered"
              span={12}
              right={
                <button
                  type="button"
                  className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 hover:underline"
                  onClick={autoFillModulesCovered}
                  title="Use the subjects from the marksheet's module table"
                >
                  <IconRefresh size={14} className="-mt-0.5 mr-1 inline-block" />
                  Auto-fill from modules table
                </button>
              }
            >
              <textarea
                className="textarea"
                rows={2}
                value={draft.modulesCovered}
                placeholder="Type freely, or auto-fill from the table"
                onChange={(e) => setDraft("modulesCovered", e.target.value)}
              />
            </Field>
            <Field label="Issued Date" span={6}>
              <input
                className="input"
                type="date"
                value={draft.issuedDate}
                onChange={(e) => setDraft("issuedDate", e.target.value)}
              />
            </Field>
          </div>
        </Section>
      )}
    </div>
  );
}

function useSimpleList(kind: SimpleKind): string[] {
  const items = useLiveQuery(
    () => db.simpleMaster.where("kind").equals(kind).filter((r) => !r.deleted).toArray(),
    [kind],
    [],
  );
  // Defensively dedupe values — React requires unique keys in the dropdown,
  // and pre-existing databases can hold duplicates from older seeding races.
  return useMemo(() => {
    const unique = Array.from(new Set((items ?? []).map((i) => i.value)));
    return sortMasterValues(kind, unique);
  }, [items]);
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <header className="mb-4 flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-700">{title}</h3>
        {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  span,
  right,
  children,
}: {
  label: string;
  span: number;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`col-span-12 md:col-span-${span} space-y-1`}>
      <div className="flex items-center justify-between">
        <label className="field-label">{label || "\u00a0"}</label>
        {right}
      </div>
      {children}
    </div>
  );
}
