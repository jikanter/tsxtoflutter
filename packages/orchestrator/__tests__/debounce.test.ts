import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { debounceTrailing } from '../src/debounce.js';

describe('debounceTrailing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('runs once on the trailing edge after the window expires', async () => {
    const fn = vi.fn(async () => {});
    const debounced = debounceTrailing(fn, 100);

    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  test('coalesces a burst into the most recent payload', async () => {
    const fn = vi.fn(async () => {});
    const debounced = debounceTrailing(fn, 100);

    debounced(1);
    await vi.advanceTimersByTimeAsync(50);
    debounced(2);
    await vi.advanceTimersByTimeAsync(50);
    debounced(3);
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  test('fires twice when calls are spaced beyond the window', async () => {
    const fn = vi.fn(async () => {});
    const debounced = debounceTrailing(fn, 100);

    debounced('first');
    await vi.advanceTimersByTimeAsync(100);
    debounced('second');
    await vi.advanceTimersByTimeAsync(100);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'first');
    expect(fn).toHaveBeenNthCalledWith(2, 'second');
  });
});
