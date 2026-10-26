// Installs IDBRequest, IDBDatabase and friends, which idb checks against.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

function openAtVersion(factory: IDBFactory, name: string, version: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, version);
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

describe("db()", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("tries again after a failed open instead of failing until reload", async () => {
    // A store already at a newer version makes Verdict's version 1 open fail.
    const broken = new IDBFactory();
    await openAtVersion(broken, "verdict", 2);
    const healthy = new IDBFactory();

    let calls = 0;
    vi.stubGlobal("indexedDB", {
      open: (name: string, version?: number) => (++calls === 1 ? broken : healthy).open(name, version),
      deleteDatabase: (name: string) => healthy.deleteDatabase(name),
      cmp: (a: unknown, b: unknown) => healthy.cmp(a, b),
      databases: () => healthy.databases(),
    });

    const { db, saveTrial, getTrial } = await import("@/lib/client/db");
    await expect(db()).rejects.toThrow();

    const trial = { id: "t1", createdAt: "2026-10-26T00:00:00.000Z" } as Parameters<typeof saveTrial>[0];
    await saveTrial(trial);
    expect(await getTrial("t1")).toMatchObject({ id: "t1" });
    expect(calls).toBe(2);
  });
});
