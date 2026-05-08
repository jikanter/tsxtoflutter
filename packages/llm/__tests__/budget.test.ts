import { describe, expect, it } from 'vitest';
import { BudgetExceededError, BudgetTracker, MODELS } from '../src/index.js';

describe('BudgetTracker', () => {
  it('accumulates token usage across calls', () => {
    const b = new BudgetTracker({ maxCostUsd: 1, maxInputTokens: 1_000_000 });
    b.recordUsage({ model: MODELS.sonnet, inputTokens: 1_000, outputTokens: 500 });
    b.recordUsage({ model: MODELS.sonnet, inputTokens: 2_000, outputTokens: 100 });
    const t = b.snapshot();
    expect(t.inputTokens).toBe(3_000);
    expect(t.outputTokens).toBe(600);
    expect(t.costUsd).toBeGreaterThan(0);
  });

  it('fails closed on cost overrun and never silently exceeds', () => {
    const b = new BudgetTracker({ maxCostUsd: 0.001 }); // $0.001 cap forces overrun
    expect(() =>
      b.recordUsage({
        model: MODELS.sonnet,
        inputTokens: 100_000,
        outputTokens: 10_000,
      }),
    ).toThrow(BudgetExceededError);
  });

  it('fails closed on input-token overrun', () => {
    const b = new BudgetTracker({ maxInputTokens: 100, maxCostUsd: 999 });
    try {
      b.recordUsage({ model: MODELS.sonnet, inputTokens: 200 });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BudgetExceededError);
      expect((err as BudgetExceededError).cap).toBe('maxInputTokens');
    }
  });

  it('counts tool turns and fails closed on MAX_TURNS', () => {
    const b = new BudgetTracker({ maxToolTurns: 2 });
    b.recordToolTurn();
    b.recordToolTurn();
    expect(() => b.recordToolTurn()).toThrow(BudgetExceededError);
  });

  it('reports cache-hit rate from cache_read vs total billable input', () => {
    const b = new BudgetTracker();
    b.recordUsage({
      model: MODELS.sonnet,
      inputTokens: 1_000,
      cacheReadInputTokens: 9_000,
      cacheCreationInputTokens: 0,
    });
    expect(b.cacheHitRate()).toBeCloseTo(0.9, 2);
  });

  it('errors when an unknown model has no pricing entry', () => {
    const b = new BudgetTracker();
    expect(() => b.recordUsage({ model: 'no-such-model', inputTokens: 1 })).toThrow(
      /No pricing entry/,
    );
  });
});
