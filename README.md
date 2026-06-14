# RITE Computer Education — Document Studio

A modern, **fully offline** desktop-style web app that fills, previews and prints
the two official RITE documents:

1. **Statement of Marks**
2. **Certificate of Course Completion**

One student record powers both documents. All data is stored locally in your
browser via IndexedDB (Dexie), so records survive page refreshes and computer
restarts without any server.

---

## Features

- **Two-pane editor** — clean form on the left, real-time A4 preview on the
  right with the official template as a pixel-accurate background.
- **Shared records** — one record fills both the marksheet and the certificate.
- **Dynamic modules table** — add/remove rows freely; total marks, percentage
  and grade are calculated automatically using the published rule:
  - `> 75%` → **Excellent**
  - `51% – 74%` → **Very Good**
  - `30% – 50%` → **Satisfactory**
  - `< 30%` → **Fail**
- **Auto Registration No.** — `RITE-2026-0001`, `RITE-2026-0002`, … with manual
  override allowed.
- **Saved candidates sidebar** — search by name or registration number, with
  Edit and Delete actions.
- **Validation** — required fields, numeric-only marks, `marks obtained` is
  clamped to `max marks`.
- **Print calibration** — toggle between:
  - **Full Print** — template background **+** data (plain paper).
  - **Pre-printed Sheet** — data only (printed onto the physical pre-printed
    sheet).
  - X / Y offset sliders (in millimetres) to nudge the text to perfectly align
    with your physical sheet. The offsets are remembered per document.
- **A4 print** at 210 × 297 mm with zero margins so the template prints
  edge-to-edge.

---

## Tech Stack

- React 18 + Vite + TypeScript
- Tailwind CSS for the modern admin-dashboard UI
- Dexie (IndexedDB) for offline persistence
- Zustand for in-memory app state
- **No backend, no internet.**

---

## Run Locally

> Requires Node.js **18 or newer**.

```bash
# 1. Install dependencies (one-time, requires internet)
npm install

# 2. Start the development server
npm run dev
#    → open the URL printed in the terminal (usually http://localhost:5173)

# 3. Build a production bundle for offline use
npm run build
npm run preview   # serves the built bundle locally
```

After `npm run build` the `dist/` folder is a fully static, self-contained
build that you can copy to any PC and open with any modern browser — **no
internet required**.

---

## Printing tips

1. Click **Print / Save PDF** (top-right of the preview pane) or hit `Ctrl+P`.
2. In the browser print dialog:
   - **Destination** → your printer (or *Save as PDF*).
   - **Paper size** → **A4**.
   - **Margins** → **None**.
   - **Background graphics** → **ON** (important — this is what makes the
     template colours / borders print on plain paper).
   - **Scale** → **100% / Default** (do NOT use *Fit to page*).
3. To print on the physical pre-printed certificate sheet, switch to
   **Pre-printed Sheet** mode in the *Calibrate* panel. Only the text will
   print so it lands on the blank spaces of your physical sheet. Use the
   X / Y offset sliders to fine-tune the alignment if needed.

---

## Tuning the overlay positions

If a particular field is even slightly off on the printout, open

> `src/positions.ts`

Every field has an `x` and `y` value in **millimetres** measured from the
**top-left** corner of the A4 page. Tweak the numbers and reload — both the
preview and the print output use the same numbers. The in-app X / Y sliders
are a separate, last-mile per-printer nudge.

---

## Project layout

```
src/
├── App.tsx                      ← layout shell (toolbar + sidebar + 2-pane main)
├── main.tsx                     ← React entry
├── index.css                    ← Tailwind layers + A4 + print CSS
├── store.ts                     ← Zustand state (current draft + settings)
├── db.ts                        ← Dexie DB (students + settings tables)
├── types.ts                     ← shared TypeScript types
├── utils.ts                     ← grade calc, reg-no generator, helpers
├── positions.ts                 ← ★ TUNE THE OVERLAY HERE (mm coordinates)
├── assets/
│   ├── marksheet-template.jpeg
│   └── certificate-template.jpeg
└── components/
    ├── Toolbar.tsx              ← top bar (brand + tabs + Save/Delete)
    ├── Sidebar.tsx              ← saved-records list + search
    ├── FormPanel.tsx            ← sectioned data entry form
    ├── ModuleTable.tsx          ← editable marksheet rows
    ├── PreviewPanel.tsx         ← right pane (zoom + print + calibrate)
    ├── PrintSettings.tsx        ← print mode toggle + offset sliders
    ├── MarksheetPreview.tsx     ← A4 marksheet renderer
    ├── CertificatePreview.tsx   ← A4 certificate renderer
    └── Icons.tsx                ← inline SVG icon set
```

---

## Data storage

All records live inside the browser's IndexedDB under the database name
`rite-doc-studio`. To migrate to another machine, either:

- export the `dist/` build **plus** ask the user to re-enter the records, or
- use the browser's DevTools → *Application → IndexedDB* to copy the data
  (advanced).

---

## License

Internal use for RITE Computer Education.
