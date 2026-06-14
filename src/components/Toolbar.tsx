import React from "react";
import { useUI } from "../store";
import { IconCert, IconCheck, IconFile, IconSave, IconTrash } from "./Icons";

/** Top app bar: brand, document switcher, action buttons. */
export default function Toolbar() {
  const doc = useUI((s) => s.doc);
  const setDoc = useUI((s) => s.setDoc);
  const editingId = useUI((s) => s.editingId);
  const draft = useUI((s) => s.draft);
  const saveDraft = useUI((s) => s.saveDraft);
  const deleteRecord = useUI((s) => s.deleteRecord);
  const newRecord = useUI((s) => s.newRecord);

  const [savedFlash, setSavedFlash] = React.useState(false);

  const onSave = async () => {
    await saveDraft();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <header className="flex items-center justify-between gap-4 border-b border-ink-200 bg-white/70 px-6 py-3 backdrop-blur-md">
      <div>
        <h1 className="text-base font-semibold text-ink-900">{editingId != null ? "Edit candidate" : "New candidate"}</h1>
        <p className="text-[11px] text-ink-500">Fill in the form on the left — the preview on the right updates in real time.</p>
      </div>

      <div className="flex items-center gap-1 rounded-full border border-ink-200 bg-white p-1 shadow-sm">
        <TabButton
          active={doc === "marksheet"}
          onClick={() => setDoc("marksheet")}
          icon={<IconFile size={15} />}
          label="Statement of Marks"
        />
        <TabButton
          active={doc === "certificate"}
          onClick={() => setDoc("certificate")}
          icon={<IconCert size={15} />}
          label="Certificate of Completion"
        />
      </div>

      <div className="flex items-center gap-2">
        {editingId != null && (
          <span className="chip bg-emerald-100 text-emerald-700">
            Editing #{editingId}
          </span>
        )}
        <button className="btn-secondary" onClick={newRecord}>
          New record
        </button>
        <button className="btn-primary" onClick={onSave}>
          {savedFlash ? <IconCheck size={16} /> : <IconSave size={16} />}
          {savedFlash ? "Saved" : editingId != null ? "Update" : "Save"}
        </button>
        {editingId != null && (
          <button
            className="btn-danger"
            onClick={() => {
              if (confirm(`Delete "${draft.nameOfCandidate || "this record"}"?`)) {
                deleteRecord(editingId);
              }
            }}
          >
            <IconTrash size={16} /> Delete
          </button>
        )}
      </div>
    </header>
  );
}

function TabButton({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
        active ? "bg-brand-600 text-white shadow-pop" : "text-ink-600 hover:bg-ink-100"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
