import { describe, expect, it, vi } from 'vitest';
import { createRunController } from '../src/run-controller.js';

describe('createRunController', () => {
  it('runs sequentially: a second submit waits for the first to settle', async () => {
    const order: string[] = [];
    const ctl = createRunController();
    const p1 = ctl.submit(async () => {
      order.push('start-1');
      await new Promise((r) => setTimeout(r, 10));
      order.push('end-1');
      return 1;
    });
    const p2 = ctl.submit(async () => {
      order.push('start-2');
      return 2;
    });
    expect(await p1).toBe(1);
    expect(await p2).toBe(2);
    expect(order).toEqual(['start-1', 'end-1', 'start-2']);
  });

  it('cancel() before the run starts skips the work and resolves with null', async () => {
    const ctl = createRunController();
    const slow = ctl.submit(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return 'slow';
    });
    const queued = ctl.submit(async () => 'queued');
    ctl.cancelPending();
    expect(await slow).toBe('slow');
    expect(await queued).toBeNull();
  });

  it('drops a queued run when a third one arrives — never queues more than one in flight', async () => {
    const ctl = createRunController();
    const log: number[] = [];
    const a = ctl.submit(async () => {
      await new Promise((r) => setTimeout(r, 20));
      log.push(1);
      return 1;
    });
    const b = ctl.submit(async () => {
      log.push(2);
      return 2;
    });
    const c = ctl.submit(async () => {
      log.push(3);
      return 3;
    });
    expect(await a).toBe(1);
    expect(await b).toBeNull();
    expect(await c).toBe(3);
    expect(log).toEqual([1, 3]);
  });

  it('error in one run does not poison the controller', async () => {
    const ctl = createRunController();
    const err = ctl.submit(async () => {
      throw new Error('boom');
    });
    await expect(err).rejects.toThrow('boom');
    const ok = ctl.submit(async () => 'next');
    expect(await ok).toBe('next');
  });
});

describe('createRunController + cancellation token', () => {
  it('passes an AbortSignal to the work fn that fires on cancel', async () => {
    const ctl = createRunController();
    let signalAborted = false;
    const inflight = ctl.submit(async (signal) => {
      signal.addEventListener('abort', () => {
        signalAborted = true;
      });
      await new Promise((r) => setTimeout(r, 30));
      return 'done';
    });
    // small delay to let it start
    await new Promise((r) => setTimeout(r, 5));
    ctl.cancelInflight();
    await inflight;
    expect(signalAborted).toBe(true);
    vi.clearAllMocks();
  });
});
