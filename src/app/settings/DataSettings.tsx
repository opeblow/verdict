"use client";

import { useEffect, useRef, useState } from "react";
import { getAccessCode, health, setAccessCode, type ServerHealth } from "@/lib/client/api";
import { deleteEverything, exportAll, importAll } from "@/lib/client/db";
import { useMounted } from "@/lib/client/useTrial";

export function DataSettings() {
  const [server, setServer] = useState<ServerHealth | null | undefined>(undefined);
  const mounted = useMounted();
  const [draft, setCode] = useState<string | null>(null);
  const code = draft ?? (mounted ? getAccessCode() : "");
  const [msg, setMsg] = useState<{ tone: "keep" | "stop"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void health().then(setServer);
  }, []);

  async function doExport() {
    const blob = await exportAll();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verdict-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg({ tone: "keep", text: "Export downloaded. It contains your photos, so keep it somewhere private." });
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const r = await importAll(f);
      setMsg({ tone: "keep", text: `Imported ${r.trials} trials and ${r.checkins} photos.` });
    } catch (err) {
      setMsg({ tone: "stop", text: err instanceof Error ? err.message : "Import failed." });
    }
  }

  async function doErase() {
    if (!window.confirm("Erase every trial and photo from this browser? This can't be undone.")) return;
    await deleteEverything();
    setMsg({ tone: "keep", text: "Everything has been erased from this browser." });
  }

  return (
    <div className="stack" style={{ ["--stack" as string]: "32px" }}>
      <div className="stack" style={{ ["--stack" as string]: "10px" }}>
        <p className="eyebrow">Your data</p>
        <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 52px)" }}>
          Everything is on this device.
        </h1>
        <p className="muted">Verdict keeps no copy. Export to move to another device or keep a backup.</p>
      </div>

      {msg && (
        <p className={`notice notice-${msg.tone}`} role="status">
          {msg.text}
        </p>
      )}

      <section className="stack" style={{ ["--stack" as string]: "12px" }}>
        <hr className="rule-strong" />
        <h2 style={{ fontSize: 20 }}>Export and import</h2>
        <div className="row">
          <button className="btn" onClick={doExport}>
            Export everything
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            Import a file
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
        </div>
      </section>

      <section className="stack" style={{ ["--stack" as string]: "12px" }}>
        <hr className="rule-strong" />
        <h2 style={{ fontSize: 20 }}>Demo access code</h2>
        <p className="small muted">
          {server?.accessCodeRequired
            ? "This server asks for an access code before running an analysis. It's listed in the project's testing instructions."
            : "This server doesn't need an access code."}
        </p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            setAccessCode(code.trim());
            setMsg({ tone: "keep", text: code.trim() ? "Access code saved on this device." : "Access code cleared." });
          }}
        >
          <label className="field" style={{ flex: 1, minWidth: 220 }}>
            <span>Access code</span>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
          </label>
          <button className="btn btn-ghost" type="submit" style={{ alignSelf: "end" }}>
            Save
          </button>
        </form>
      </section>

      <section className="stack" style={{ ["--stack" as string]: "12px" }}>
        <hr className="rule-strong" />
        <h2 style={{ fontSize: 20 }}>Server status</h2>
        <p className="small mono">
          {server === undefined
            ? "Checking."
            : server === null
              ? "Server unreachable."
              : server.youcamConfigured
                ? "YouCam API connected."
                : "No YouCam API key on this server. See docs/SETUP.md."}
        </p>
      </section>

      <section className="stack" style={{ ["--stack" as string]: "12px" }}>
        <hr className="rule-strong" />
        <h2 style={{ fontSize: 20 }}>Erase</h2>
        <p className="small muted">Removes all trials, photos and scores from this browser.</p>
        <div>
          <button className="btn btn-danger" onClick={doErase}>
            Erase everything
          </button>
        </div>
      </section>
    </div>
  );
}
