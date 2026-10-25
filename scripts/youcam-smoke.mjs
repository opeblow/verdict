#!/usr/bin/env node
/**
 * One live YouCam AI Skin Analysis call, end to end, using the key in
 * .env.local. Use it to confirm your key, units and network before a demo.
 *
 *   npm run smoke:youcam -- path/to/selfie.jpg [hd|sd]
 *
 * Costs one analysis worth of units. Deletes the task from YouCam afterwards.
 * Prints the raw response summary; nothing is written to disk.
 */
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

async function loadEnv() {
  try {
    const text = await readFile(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* rely on the real environment */
  }
}

await loadEnv();
const key = process.env.YOUCAM_API_KEY;
const base = (process.env.YOUCAM_API_BASE || "https://yce-api-01.makeupar.com").replace(/\/+$/, "");
const [file, modeArg = "sd"] = process.argv.slice(2);
if (!key) {
  console.error("YOUCAM_API_KEY is not set. Add it to .env.local.");
  process.exit(1);
}
if (!file) {
  console.error("Usage: npm run smoke:youcam -- path/to/selfie.jpg [hd|sd]");
  process.exit(1);
}

const mode = modeArg === "hd" ? "hd" : "sd";
const actions = mode === "hd" ? ["hd_pore", "hd_redness", "hd_texture", "hd_moisture"] : ["pore", "redness", "texture", "moisture"];
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function call(path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status} ${JSON.stringify(body)}`);
  return body;
}

const bytes = await readFile(file);
const type = /\.png$/i.test(file) ? "image/png" : "image/jpeg";

console.log(`1/4 register upload (${bytes.length} bytes, ${type})`);
const reg = await call("/s2s/v2.0/file/skin-analysis", {
  method: "POST",
  body: JSON.stringify({ files: [{ content_type: type, file_name: `smoke.${type === "image/png" ? "png" : "jpg"}`, file_size: bytes.length }] }),
});
const f = reg.data.files[0];
const put = f.requests[0];

console.log("2/4 upload to presigned URL");
const up = await fetch(put.url, { method: put.method || "PUT", headers: put.headers, body: bytes });
if (!up.ok) throw new Error(`upload failed: HTTP ${up.status}`);

console.log(`3/4 start ${mode.toUpperCase()} task: ${actions.join(", ")}`);
const task = await call("/s2s/v2.0/task/skin-analysis", {
  method: "POST",
  body: JSON.stringify({ src_file_id: f.file_id, dst_actions: actions, format: "json" }),
});
const id = task.data.task_id;

console.log("4/4 poll");
const started = Date.now();
for (;;) {
  await sleep(2000);
  const s = await call(`/s2s/v2.0/task/skin-analysis/${encodeURIComponent(id)}`);
  const status = s.data?.task_status;
  process.stdout.write(`  ${((Date.now() - started) / 1000).toFixed(0)}s ${status}\n`);
  if (status === "success") {
    for (const o of s.data.results.output) {
      console.log(`  ${o.type.padEnd(16)} ${String(o.region ?? "").padEnd(10)} raw=${o.raw_score ?? o.score ?? ""} ui=${o.ui_score ?? ""}`);
    }
    break;
  }
  if (status === "error") {
    console.log("  engine error:", s.data.error);
    break;
  }
  if (Date.now() - started > 120_000) throw new Error("timed out");
}

await call("/s2s/v2.0/task/delete", { method: "POST", body: JSON.stringify({ task_id: id }) }).then(
  () => console.log("Task deleted from YouCam."),
  (e) => console.log("Delete failed (results expire within 24h anyway):", e.message),
);
