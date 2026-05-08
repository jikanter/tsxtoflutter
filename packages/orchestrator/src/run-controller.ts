/**
 * Subprocess / async-task lifecycle controller.
 *
 * Phase 2 R1 says: "kill prior Dart codegen subprocess on new change burst;
 * never queue more than one in flight." This controller enforces those
 * semantics for arbitrary async work — the caller passes a function that
 * receives an AbortSignal, and the controller serializes runs so at most
 * one is executing and at most one is pending. A third submit displaces
 * the pending one (its promise resolves with null).
 */

export type RunFn<T> = (signal: AbortSignal) => Promise<T>;

interface PendingEntry<T> {
  fn: RunFn<T>;
  resolve: (value: T | null) => void;
  reject: (reason: unknown) => void;
}

export interface RunController {
  submit<T>(fn: RunFn<T>): Promise<T | null>;
  cancelInflight(): void;
  cancelPending(): void;
}

export function createRunController(): RunController {
  let inflight: AbortController | null = null;
  let pending: PendingEntry<unknown> | null = null;
  let running = false;

  const drain = async () => {
    if (running) return;
    if (pending === null) return;
    running = true;
    while (pending !== null) {
      const next = pending;
      pending = null;
      const ac = new AbortController();
      inflight = ac;
      try {
        const result = await next.fn(ac.signal);
        next.resolve(result);
      } catch (err) {
        next.reject(err);
      } finally {
        inflight = null;
      }
    }
    running = false;
  };

  return {
    submit<T>(fn: RunFn<T>): Promise<T | null> {
      return new Promise<T | null>((resolve, reject) => {
        // Displace any older pending entry (resolve null) — never queue >1.
        if (pending !== null) {
          pending.resolve(null);
        }
        pending = {
          fn: fn as RunFn<unknown>,
          resolve: resolve as (v: unknown) => void,
          reject,
        };
        void drain();
      });
    },
    cancelInflight() {
      inflight?.abort();
    },
    cancelPending() {
      if (pending !== null) {
        pending.resolve(null);
        pending = null;
      }
    },
  };
}
