#!/usr/bin/env node
/**
 * Regenerates the README screenshots and the PNG app icons.
 *
 *   npm run build && npm run screenshots
 *
 * Starts the production server, seeds this browser profile's IndexedDB with
 * three sample trials (illustrated faces, sample scores), and captures pages
 * at desktop and phone sizes. No YouCam call is made.
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const OUT = "docs/screenshots";

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error("Server did not start");
}

/** Runs inside the page. Builds sample trials and writes them to IndexedDB. */
async function seed() {
  const DAY = 86_400_000;
  const now = Date.now();

  function face(tone, blemishes, seedN) {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 1200;
    const g = c.getContext("2d");
    g.fillStyle = "#d9d2c5";
    g.fillRect(0, 0, 900, 1200);
    g.fillStyle = "#3a2f28";
    g.beginPath();
    g.ellipse(450, 470, 330, 420, 0, Math.PI, 2 * Math.PI);
    g.fill();
    g.fillStyle = tone;
    g.beginPath();
    g.ellipse(450, 560, 300, 380, 0, 0, 2 * Math.PI);
    g.fill();
    g.fillRect(380, 900, 140, 300);
    g.fillStyle = "rgba(60,40,30,0.85)";
    for (const x of [340, 560]) {
      g.beginPath();
      g.ellipse(x, 520, 34, 16, 0, 0, 2 * Math.PI);
      g.fill();
    }
    g.strokeStyle = "rgba(60,40,30,0.5)";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(450, 560);
    g.lineTo(430, 680);
    g.lineTo(465, 690);
    g.stroke();
    g.strokeStyle = "rgba(120,60,50,0.8)";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(450, 740, 70, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
    let s = seedN;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    g.fillStyle = "rgba(170,70,60,0.55)";
    for (let i = 0; i < blemishes; i++) {
      g.beginPath();
      g.arc(250 + rnd() * 400, 600 + rnd() * 250, 5 + rnd() * 6, 0, 2 * Math.PI);
      g.fill();
    }
    return c;
  }

  function mask(count, seedN) {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 1200;
    const g = c.getContext("2d");
    let s = seedN;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    g.fillStyle = "rgba(255,190,60,0.9)";
    for (let i = 0; i < count; i++) {
      g.beginPath();
      g.arc(270 + rnd() * 360, 560 + rnd() * 260, 3 + rnd() * 3, 0, 2 * Math.PI);
      g.fill();
    }
    return c;
  }

  const blob = (canvas, type = "image/jpeg") => new Promise((r) => canvas.toBlob(r, type, 0.9));

  const conditions = (luma) => ({ luma, balance: 0.03, warmth: 1.17, sharpness: 46, clipped: 0.003, width: 900, height: 1200 });

  async function build(trial, series, weeks, tone, blemishFn, poreFn) {
    const start = new Date(trial.startedAt).getTime();
    const checkins = [];
    const n = 2 + weeks;
    for (let i = 0; i < n; i++) {
      const isBase = i < 2;
      const week = isBase ? 0 : i - 1;
      const readings = Object.entries(series)
        .filter(([, v]) => v[i] !== undefined)
        .map(([c, v]) => ({ key: c, concern: c, region: "whole", raw: v[i], ui: Math.round(55 + v[i] * 0.4) }));
      checkins.push({
        id: `${trial.id}-c${i}`,
        trialId: trial.id,
        takenAt: new Date(start + week * 7 * DAY + (isBase ? i * 90_000 : 0)).toISOString(),
        kind: isBase ? "baseline" : "check-in",
        session: isBase ? `${trial.id}-s0` : `${trial.id}-s${week}`,
        readings,
        overall: 70,
        conditions: conditions(140 + ((i * 7) % 9) - 4),
        taskId: `sample-${trial.id}-${i}`,
        photo: await blob(face(tone, blemishFn(i), 7 + i)),
        masks: { pore: await blob(mask(poreFn(i), 3 + i), "image/png"), acne: await blob(mask(blemishFn(i), 11 + i), "image/png") },
      });
    }
    return checkins;
  }

  const base = { createdAt: "", cadenceDays: 7, status: "active", protocol: { place: "Bathroom, facing the window", timeOfDay: "morning" } };

  const t1 = {
    ...base,
    id: "sample-niacinamide",
    startedAt: new Date(now - 56 * DAY - 3600_000).toISOString(),
    product: { name: "Niacinamide 10% serum", brand: "Sample brand", source: "manual", price: 12, currency: "USD", weeksPerUnit: 8 },
    activeIds: ["niacinamide", "zinc"],
    targets: ["pore", "oiliness"],
    concerns: ["pore", "oiliness", "redness", "moisture", "texture", "acne", "radiance", "age_spot"],
    mode: "hd",
  };
  t1.createdAt = t1.startedAt;
  const s1 = {
    pore: [51.2, 49.9, 50.8, 52.3, 51.6, 53.9, 54.4, 55.8, 56.1, 57.0],
    oiliness: [60.4, 61.9, 62.5, 63.8, 64.9, 64.1, 66.7, 67.2, 68.4, 68.0],
    redness: [70.1, 69.2, 70.4, 69.6, 70.9, 70.2, 69.8, 70.6, 71.1, 70.3],
    moisture: [55.0, 56.1, 55.4, 54.8, 56.3, 55.7, 56.0, 55.2, 56.4, 55.9],
    texture: [64.2, 63.1, 64.0, 64.9, 64.4, 65.2, 65.0, 65.8, 66.1, 65.7],
    acne: [72.3, 73.0, 72.1, 72.8, 73.4, 72.6, 73.1, 73.9, 73.2, 74.0],
    radiance: [58.8, 59.6, 59.1, 60.2, 59.4, 60.0, 60.6, 59.9, 60.8, 60.4],
    age_spot: [77.9, 78.4, 78.0, 77.6, 78.3, 78.8, 78.1, 78.5, 78.9, 78.6],
  };

  const t2 = {
    ...base,
    id: "sample-retinol",
    startedAt: new Date(now - 21 * DAY - 3600_000).toISOString(),
    product: { name: "Retinol 0.3% night cream", brand: "Sample brand", source: "manual", price: 28, currency: "USD", weeksPerUnit: 10 },
    activeIds: ["retinol"],
    targets: ["texture", "wrinkle", "acne"],
    concerns: ["texture", "wrinkle", "acne", "redness"],
    mode: "hd",
  };
  t2.createdAt = t2.startedAt;
  const s2 = {
    texture: [61.0, 62.1, 61.4, 62.0, 62.6],
    wrinkle: [66.2, 65.4, 66.0, 65.8, 66.4],
    acne: [75.2, 76.0, 71.1, 67.4, 65.9],
    redness: [71.0, 70.4, 70.1, 70.9, 69.8],
  };

  const t3 = {
    ...base,
    id: "sample-hyaluronic",
    startedAt: new Date(now - 70 * DAY).toISOString(),
    product: { name: "Hyaluronic acid toner", brand: "Sample brand", source: "manual", price: 18, currency: "USD", weeksPerUnit: 6 },
    activeIds: ["hyaluronic"],
    targets: ["moisture"],
    concerns: ["moisture", "redness", "texture", "acne"],
    mode: "hd",
    status: "ended",
    endedAt: new Date(now - 14 * DAY).toISOString(),
    outcome: "stopped",
  };
  t3.createdAt = t3.startedAt;
  const s3 = {
    moisture: [52.0, 52.6, 52.3, 51.9, 52.4, 52.1, 52.5],
    redness: [70, 70.5, 70.2, 69.9, 70.4, 70.1, 70.3],
    texture: [63, 63.4, 63.1, 63.3, 62.9, 63.2, 63.0],
    acne: [74, 73.6, 74.1, 73.9, 74.2, 73.8, 74.0],
  };

  const records = [
    [t1, await build(t1, s1, 8, "#c9926f", (i) => Math.max(2, 9 - Math.floor(i / 2)), (i) => Math.max(40, 140 - i * 10))],
    [t2, await build(t2, s2, 3, "#8d5a3f", (i) => [5, 5, 9, 13, 14][i] ?? 10, () => 90)],
    [t3, await build(t3, s3, 5, "#e2b896", () => 4, () => 60)],
  ];

  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open("verdict", 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore("trials", { keyPath: "id" }).createIndex("byCreated", "createdAt");
      d.createObjectStore("checkins", { keyPath: "id" }).createIndex("byTrial", "trialId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = db.transaction(["trials", "checkins"], "readwrite");
  for (const [t, cs] of records) {
    tx.objectStore("trials").put(t);
    for (const c of cs) tx.objectStore("checkins").put(c);
  }
  await new Promise((r, j) => {
    tx.oncomplete = r;
    tx.onerror = () => j(tx.error);
  });
  db.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    stdio: "ignore",
    env: { ...process.env, YOUCAM_API_KEY: "screenshot-mode-no-calls" },
  });
  try {
    await waitForServer();
    const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5, colorScheme: "light" });
    await ctx.grantPermissions(["camera"], { origin: BASE });
    const page = await ctx.newPage();

    // Icons from the SVG mark.
    await page.goto(`${BASE}/icon.svg`);
    for (const size of [192, 512]) {
      const p = await ctx.newPage();
      await p.setViewportSize({ width: size, height: size });
      await p.setContent(`<style>html,body{margin:0;background:#f5f2ec}</style><img src="${BASE}/icon.svg" width="${size}" height="${size}">`);
      await p.waitForLoadState("networkidle");
      await p.screenshot({ path: `public/icon-${size}.png`, omitBackground: false });
      if (size === 192) await p.screenshot({ path: "src/app/apple-icon.png" });
      await p.close();
    }

    await page.goto(`${BASE}/`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${OUT}/landing.png` });

    await page.goto(`${BASE}/trials`);
    await page.evaluate(seed);

    await page.goto(`${BASE}/trials`);
    await page.waitForSelector("text=Niacinamide 10% serum");
    await page.screenshot({ path: `${OUT}/trials.png`, clip: { x: 0, y: 0, width: 1440, height: 640 } });

    await page.goto(`${BASE}/trials/sample-niacinamide`);
    await page.waitForSelector("text=Targets");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: true });

    await page.goto(`${BASE}/trials/sample-retinol`);
    await page.waitForSelector("text=Targets");
    await page.screenshot({ path: `${OUT}/dashboard-purging.png`, fullPage: true });

    await page.goto(`${BASE}/method`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${OUT}/method.png`, clip: { x: 0, y: 0, width: 1440, height: 1500 } });

    await page.goto(`${BASE}/trials/new`);
    await page.getByRole("tab", { name: "Enter by hand" }).click();
    await page.getByLabel("Product name").fill("Niacinamide 10% serum");
    await page.getByLabel("Brand").fill("Sample brand");
    await page.getByLabel("Ingredients").fill("Aqua, Niacinamide, Pentylene Glycol, Zinc PCA, Tamarindus Indica Seed Gum, Xanthan Gum");
    await page.getByRole("button", { name: "Use this product" }).click();
    await page.waitForSelector("text=Active ingredients");
    await page.screenshot({ path: `${OUT}/new-trial-goals.png`, fullPage: true });

    await page.goto(`${BASE}/trials/sample-niacinamide/check-in`);
    await page.getByRole("button", { name: "Open camera" }).click();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/check-in.png`, fullPage: true });

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const m = await phone.newPage();
    await m.goto(`${BASE}/trials`);
    await m.evaluate(seed);
    await m.goto(`${BASE}/trials/sample-niacinamide`);
    await m.waitForSelector("text=Targets");
    await m.screenshot({ path: `${OUT}/mobile.png`, clip: { x: 0, y: 0, width: 390, height: 1500 }, fullPage: true });
    await m.goto(`${BASE}/`);
    await m.screenshot({ path: `${OUT}/mobile-landing.png` });

    const dark = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1.5, colorScheme: "dark" });
    const d = await dark.newPage();
    await d.goto(`${BASE}/`);
    await d.waitForLoadState("networkidle");
    await d.screenshot({ path: `${OUT}/landing-dark.png` });

    await browser.close();
    console.log(`Screenshots written to ${OUT}/`);
  } finally {
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
