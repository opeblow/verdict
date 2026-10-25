/**
 * Sliding-window rate limiter held in memory.
 *
 * On serverless hosts each instance keeps its own window, so this is a
 * best-effort guard against accidental or casual abuse of the API units,
 * not a security boundary. SECURITY.md describes swapping in a shared store.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit and returns whether it is allowed, plus seconds until the next slot frees. */
  take(key: string): { ok: boolean; retryAfter: number } {
    const t = this.now();
    const since = t - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((h) => h > since);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return { ok: false, retryAfter: Math.max(1, Math.ceil((list[0]! + this.windowMs - t) / 1000)) };
    }
    list.push(t);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.prune(since);
    return { ok: true, retryAfter: 0 };
  }

  private prune(since: number) {
    for (const [k, v] of this.hits) {
      const kept = v.filter((h) => h > since);
      if (kept.length) this.hits.set(k, kept);
      else this.hits.delete(k);
    }
  }
}

export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "local";
}
