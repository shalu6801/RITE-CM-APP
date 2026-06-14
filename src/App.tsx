import React, { useEffect, useState } from "react";
import { useUI } from "./store";
import NavRail from "./components/NavRail";
import Toolbar from "./components/Toolbar";
import FormPanel from "./components/FormPanel";
import PreviewPanel from "./components/PreviewPanel";
import DashboardPage from "./components/DashboardPage";
import RecordsPage from "./components/RecordsPage";
import SettingsPage from "./components/SettingsPage";
import MasterDataPage from "./components/MasterDataPanel";
import MarksheetPreview from "./components/MarksheetPreview";
import CertificatePreview from "./components/CertificatePreview";
import LoginPage from "./components/LoginPage";
import { clearSession, getStoredIdentity, getStoredToken } from "./auth";
import { setOnSettingsPulled, startBackgroundSync, stopBackgroundSync } from "./sync";

/**
 * Application shell.
 *
 *  ┌──────────┬───────────────────────────────────────────────┐
 *  │ NavRail  │  Active page (Dashboard · Editor · …)         │
 *  └──────────┴───────────────────────────────────────────────┘
 *
 *  Plus a hidden PrintStage rendered at root that holds an UNSCALED 1:1
 *  copy of the active document for printing & PDF export.
 */
export default function App() {
  const init = useUI((s) => s.init);
  const reloadSettings = useUI((s) => s.reloadSettings);
  const ready = useUI((s) => s.ready);
  const page = useUI((s) => s.page);

  // Auth gate — keep a token + identity in component state, hydrated from
  // localStorage. The whole app is hidden until a token is present.
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [identity, setIdentity] = useState<string | null>(() => getStoredIdentity());

  useEffect(() => { init(); }, [init]);

  // Cross-device sync: start the background loop the moment we have an auth
  // token + a ready Dexie, stop it on logout. The settings callback re-hydrates
  // the in-memory store from IndexedDB whenever the server hands us a newer
  // settings row.
  useEffect(() => {
    setOnSettingsPulled(() => { void reloadSettings(); });
    return () => setOnSettingsPulled(null);
  }, [reloadSettings]);
  useEffect(() => {
    if (token && ready) startBackgroundSync();
    else stopBackgroundSync();
  }, [token, ready]);

  if (!ready) {
    return <div className="flex h-screen items-center justify-center text-ink-500">Loading…</div>;
  }

  if (!token) {
    return (
      <LoginPage
        onAuthenticated={(t, id) => { setToken(t); setIdentity(id); }}
      />
    );
  }

  const logout = () => { clearSession(); setToken(null); setIdentity(null); };

  return (
    <>
      <div className="screen-shell flex h-screen overflow-hidden">
        <NavRail identity={identity} onLogout={logout} />
        <main className="flex flex-1 flex-col overflow-hidden">
          {page === "editor" ? <EditorView /> : <ScrollPage>{renderPage(page)}</ScrollPage>}
        </main>
      </div>
      <PrintStage />
    </>
  );
}

function renderPage(page: string) {
  switch (page) {
    case "dashboard": return <DashboardPage />;
    case "records":   return <RecordsPage />;
    case "master":    return <MasterDataPage />;
    case "settings":  return <SettingsPage />;
    default:          return <DashboardPage />;
  }
}

function ScrollPage({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-auto p-8">{children}</div>;
}

function EditorView() {
  return (
    <>
      <Toolbar />
      <div className="grid flex-1 grid-cols-1 gap-5 overflow-hidden p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="flex h-full flex-col overflow-y-auto pr-1">
          <FormPanel />
        </section>
        <section className="flex h-full flex-col overflow-hidden">
          <PreviewPanel />
        </section>
      </div>
    </>
  );
}

/**
 * Off-screen, 1:1, no-scale A4 stage.
 *
 *  • Used as the source for window.print() — @media print hides everything else
 *    and brings this on-screen at (0, 0).
 *  • Used as the source for html2canvas → jsPDF (Save PDF), since the element
 *    still has full pixel dimensions even while positioned off-screen.
 *  • The screen-side preview pane scales for visibility, but this stage is
 *    NEVER scaled, so the print/PDF output is always full A4.
 */
function PrintStage() {
  const doc = useUI((s) => s.doc);
  const draft = useUI((s) => s.draft);
  const settings = useUI((s) => s.settings);
  return (
    <div id="print-stage-root" className="print-stage">
      {doc === "marksheet" ? (
        <MarksheetPreview record={draft} settings={settings} printActive />
      ) : (
        <CertificatePreview record={draft} settings={settings} printActive />
      )}
    </div>
  );
}
