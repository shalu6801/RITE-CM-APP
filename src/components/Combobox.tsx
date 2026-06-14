import React, { useEffect, useMemo, useRef, useState } from "react";

interface ComboboxProps {
  /** Current value (controlled). */
  value: string;
  /** Existing options to show in the dropdown. */
  options: string[];
  /** Called on every keystroke + on selection (so the parent always has the latest text). */
  onChange: (next: string) => void;
  /** Called only when the user explicitly picks an existing option from the list. */
  onPick?: (picked: string) => void;
  /** If provided, the dropdown shows an "+ Add new" row that calls this to persist a brand-new value. */
  onAdd?: (newValue: string) => Promise<void> | void;
  placeholder?: string;
  /** True → reads only; just shows the value, no dropdown. */
  readOnly?: boolean;
  /** Extra utility content rendered above the options list (e.g. "Manage list" link). */
  footer?: React.ReactNode;
}

/**
 * A small, dependency-free searchable combobox.
 *
 *  • Typing filters the visible options
 *  • Up/Down + Enter keyboard nav
 *  • Esc closes
 *  • If the typed value isn't an exact match, an "+ Add 'foo'" row appears at the bottom
 */
export default function Combobox({
  value,
  options,
  onChange,
  onPick,
  onAdd,
  placeholder,
  readOnly,
  footer,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const trimmed = value.trim();
  const exactMatch = options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  /**
   * Filtering rule:
   *  • If the current value is empty OR exactly matches an option (i.e. the
   *    user has selected something already), show ALL options — opening the
   *    dropdown should always let you switch to any other entry, including
   *    newly-added ones.
   *  • Otherwise (user is typing something that doesn't match any option),
   *    filter by partial match so search works.
   */
  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q || exactMatch) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, trimmed, exactMatch]);

  const canAddNew = !!onAdd && !!trimmed && !exactMatch;

  const pick = (val: string) => {
    onChange(val);
    setOpen(false);
    setActive(-1);
    onPick?.(val);
  };

  const addNew = async () => {
    if (!onAdd || !trimmed) return;
    await onAdd(trimmed);
    pick(trimmed);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (readOnly) return;
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      setActive(0);
      e.preventDefault();
      return;
    }
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); setActive(-1); return; }

    const total = filtered.length + (canAddNew ? 1 : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (total === 0 ? -1 : (i + 1) % total));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (total === 0 ? -1 : (i - 1 + total) % total));
    } else if (e.key === "Enter") {
      if (active >= 0) {
        if (active < filtered.length) { pick(filtered[active]); }
        else if (canAddNew) { addNew(); }
        e.preventDefault();
      } else if (canAddNew) {
        addNew();
        e.preventDefault();
      } else if (filtered.length === 1) {
        pick(filtered[0]);
        e.preventDefault();
      }
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        className="input pr-9"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => !readOnly && setOpen(true)}
        onKeyDown={handleKey}
      />
      {!readOnly && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle options"
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
      {open && !readOnly && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-ink-200 bg-white shadow-lg"
          role="listbox"
        >
          {filtered.length === 0 && !canAddNew && (
            <div className="px-3 py-3 text-sm text-ink-400">No matches</div>
          )}
          {filtered.map((opt, i) => (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={opt === value}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(opt)}
              className={[
                "flex w-full items-center px-3 py-2 text-left text-sm transition",
                opt === value ? "font-semibold text-brand-700" : "text-ink-700",
                active === i ? "bg-brand-50" : "hover:bg-ink-50",
              ].join(" ")}
            >
              {opt}
            </button>
          ))}
          {canAddNew && (
            <button
              type="button"
              onMouseEnter={() => setActive(filtered.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={addNew}
              className={[
                "flex w-full items-center gap-2 border-t border-ink-100 px-3 py-2 text-left text-sm font-medium text-brand-600",
                active === filtered.length ? "bg-brand-50" : "hover:bg-brand-50",
              ].join(" ")}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700">+</span>
              Add &ldquo;{trimmed}&rdquo;
            </button>
          )}
          {footer && (
            <div className="border-t border-ink-100 bg-ink-50/50 px-3 py-2 text-[12px] text-ink-500">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
