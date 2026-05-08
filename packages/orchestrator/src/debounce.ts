/**
 * Trailing-edge debouncer. Calls within `windowMs` of one another are
 * coalesced into a single invocation that fires once the burst has settled,
 * with the *last* arguments passed.
 *
 * No leading edge — chokidar bursts almost always represent the same logical
 * save, so the first event is rarely the one we care about.
 */
export function debounceTrailing<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void | Promise<void>,
  windowMs: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;

  return (...args: TArgs) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) void fn(...a);
    }, windowMs);
  };
}
