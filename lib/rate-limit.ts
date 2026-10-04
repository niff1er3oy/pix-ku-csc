import "server-only";

/**
 * In-process rate limiting: a sliding-window counter and a concurrency gate.
 *
 * In memory rather than in Postgres on purpose. The limiters this replaces
 * counted rows — "how many searches has this address *finished* in the last
 * minute" — which has two holes a database round trip cannot close cheaply:
 *
 *  - anything that failed never became a row, so it was never counted. A
 *    selfie with no face in it still cost a Rekognition call and was free to
 *    repeat forever;
 *  - the count and the insert were two statements with real work between
 *    them, so a burst of parallel requests all read the same low count before
 *    any of them wrote. Five PIN guesses per ten minutes was really "as many
 *    as you can send at once" per ten minutes.
 *
 * `takeHit` checks and records in one synchronous step, before any `await`,
 * so there is no gap for a second request to slip through.
 *
 * The state lives on `globalThis` so a route handler and a Server Action —
 * which Next can bundle as separate copies of this module — still share one
 * set of counters, and so a dev-server reload does not hand everyone a fresh
 * allowance. It is per process, which is what `ecosystem.config.cjs` already
 * commits this app to (`instances: 1`); a restart clears it, and that is an
 * accepted cost, not an oversight.
 */

type Window = { times: number[]; windowMs: number };

type GateState = { active: number; waiting: (() => void)[] };

type Store = {
  windows: Map<string, Window>;
  gates: Map<string, GateState>;
  sinceSweep: number;
};

const holder = globalThis as typeof globalThis & { __pixRateLimit?: Store };
const store: Store = (holder.__pixRateLimit ??= {
  windows: new Map(),
  gates: new Map(),
  sinceSweep: 0,
});

/** How many `takeHit` calls go by between sweeps of expired keys. */
const SWEEP_EVERY = 500;

/**
 * Records one attempt under `key` and reports whether it is allowed: `true`
 * while fewer than `limit` attempts were admitted in the last `windowMs`.
 *
 * A refused attempt is not recorded, so being limited does not extend the
 * wait — the window slides off the attempts that were actually let through.
 */
export function takeHit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  if (++store.sinceSweep >= SWEEP_EVERY) {
    store.sinceSweep = 0;
    // Keys are caller-chosen and can be minted without bound (one per forged
    // address), so entries whose whole window has passed are dropped here
    // rather than left to accumulate.
    for (const [k, w] of store.windows) {
      const last = w.times[w.times.length - 1];
      if (last === undefined || last <= now - w.windowMs) store.windows.delete(k);
    }
  }

  const cutoff = now - windowMs;
  const recent = (store.windows.get(key)?.times ?? []).filter((t) => t > cutoff);
  const allowed = recent.length < limit;
  if (allowed) recent.push(now);
  store.windows.set(key, { times: recent, windowMs });
  return allowed;
}

export type Gate = {
  /** Resolves `true` once a slot is held, `false` if none could be had. */
  enter(): Promise<boolean>;
  /** Gives the slot back. Call exactly once per `enter()` that returned true. */
  leave(): void;
};

/**
 * At most `maxActive` holders at once, with up to `maxWaiting` more queued
 * for at most `maxWaitMs` each. Anything past that is turned away at once
 * instead of joining a line that would outlast the caller's patience.
 *
 * Same slot-handoff rule as the indexing semaphore in lib/face/pipeline.ts:
 * `leave()` passes its slot straight to the next waiter without the count
 * ever dropping, so a newcomer cannot take it out of turn in between.
 */
export function gate(
  name: string,
  maxActive: number,
  maxWaiting: number,
  maxWaitMs: number,
): Gate {
  let state = store.gates.get(name);
  if (!state) {
    state = { active: 0, waiting: [] };
    store.gates.set(name, state);
  }
  const s = state;

  return {
    enter() {
      if (s.active < maxActive) {
        s.active++;
        return Promise.resolve(true);
      }
      if (s.waiting.length >= maxWaiting) return Promise.resolve(false);

      return new Promise<boolean>((resolve) => {
        const admit = () => {
          clearTimeout(timer);
          resolve(true);
        };
        const timer = setTimeout(() => {
          // Still queued, so no slot was ever handed over: step out of line.
          // Had `leave()` already shifted this waiter, `admit` would have
          // run and cancelled this timer — a waiter can never both give up
          // and be given a slot, which is what would leak one.
          const at = s.waiting.indexOf(admit);
          if (at === -1) return;
          s.waiting.splice(at, 1);
          resolve(false);
        }, maxWaitMs);
        s.waiting.push(admit);
      });
    },

    leave() {
      const next = s.waiting.shift();
      if (next) next();
      else s.active--;
    },
  };
}

/**
 * Rejects if `work` has not settled within `ms`. The work itself is not
 * cancelled — nothing here can reach into an in-flight AWS call — but the
 * caller stops waiting, which is what lets a `finally` give a gate slot back
 * instead of a single hung request holding it for good.
 */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
