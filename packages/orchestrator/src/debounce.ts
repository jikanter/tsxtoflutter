/**
 * Trailing-edge debouncer that coalesces a burst of `notify(payload)` calls
 * into a single `fn(payloads)` invocation at the end of the quiet window.
 *
 * Used by the watcher (Phase 2 R1) to collapse editor save bursts (often
 * 3–5 fs events for a single Cmd+S) into one ingest+codegen cycle.
 */

export interface DebouncerOptions<T> {
  windowMs: number;
  /** When true, identical payloads (===) are deduped within a window. */
  dedupe?: boolean;
  /** Optional comparator for dedupe. Defaults to ===. */
  equal?: (a: T, b: T) => boolean;
}

export interface Debouncer<T> {
  notify(payload: T): void;
  cancel(): void;
}

export function createDebouncer<T>(
  fn: (payloads: T[]) => unknown,
  options: DebouncerOptions<T>,
): Debouncer<T> {
  const { windowMs, dedupe = false, equal = (a, b) => a === b } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: T[] = [];

  const fire = () => {
    timer = null;
    const payload = queue;
    queue = [];
    void fn(payload);
  };

  return {
    notify(payload: T) {
      if (dedupe && queue.some((existing) => equal(existing, payload))) {
        // already pending, no-op
      } else {
        queue.push(payload);
      }
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(fire, windowMs);
    },
    cancel() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      queue = [];
    },
  };
}
