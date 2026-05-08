import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncer } from '../src/debounce.js';

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces a burst of calls into one execution at the end of the window', async () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, { windowMs: 100 });
    d.notify('a');
    d.notify('b');
    d.notify('c');
    expect(fn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('runs again after the window if more events arrive after settling', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const d = createDebouncer(fn, { windowMs: 50 });
    d.notify('x');
    await vi.advanceTimersByTimeAsync(50);
    expect(fn).toHaveBeenCalledTimes(1);
    d.notify('y');
    await vi.advanceTimersByTimeAsync(50);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(['y']);
  });

  it('cancel() clears a pending burst', async () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, { windowMs: 100 });
    d.notify('a');
    d.cancel();
    await vi.advanceTimersByTimeAsync(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('deduplicates identical payloads in a single window', async () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, { windowMs: 100, dedupe: true });
    d.notify('same');
    d.notify('same');
    d.notify('other');
    d.notify('same');
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledWith(['same', 'other']);
  });
});
