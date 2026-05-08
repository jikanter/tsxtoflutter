import { priceFor, type ModelPricing } from './pricing.js';

export interface BudgetCaps {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxToolTurns: number;
  maxCostUsd: number;
}

export const DEFAULT_BUDGET: BudgetCaps = {
  maxInputTokens: 200_000,
  maxOutputTokens: 16_000,
  maxToolTurns: 8,
  maxCostUsd: 0.5,
};

export interface UsageDelta {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  toolTurns: number;
  costUsd: number;
}

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly cap: keyof BudgetCaps,
    public readonly totals: UsageTotals,
  ) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

/**
 * Tracks cumulative LLM usage against per-conversion caps. Fail-closed: every
 * mutator throws `BudgetExceededError` the moment a cap is breached. Callers
 * are expected to bubble this up so the conversion is marked `failed` and the
 * partial trace is preserved (R5).
 */
export class BudgetTracker {
  private readonly caps: BudgetCaps;
  private readonly totals: UsageTotals = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    toolTurns: 0,
    costUsd: 0,
  };

  constructor(caps: Partial<BudgetCaps> = {}) {
    this.caps = { ...DEFAULT_BUDGET, ...caps };
  }

  recordUsage(delta: UsageDelta): void {
    const price: ModelPricing = priceFor(delta.model);
    const inputTokens = delta.inputTokens ?? 0;
    const outputTokens = delta.outputTokens ?? 0;
    const cacheRead = delta.cacheReadInputTokens ?? 0;
    const cacheCreate = delta.cacheCreationInputTokens ?? 0;

    this.totals.inputTokens += inputTokens;
    this.totals.outputTokens += outputTokens;
    this.totals.cacheReadInputTokens += cacheRead;
    this.totals.cacheCreationInputTokens += cacheCreate;

    const cost =
      (inputTokens * price.inputPerMTok) / 1_000_000 +
      (outputTokens * price.outputPerMTok) / 1_000_000 +
      (cacheRead * price.cacheReadPerMTok) / 1_000_000 +
      (cacheCreate * price.cacheCreatePerMTok) / 1_000_000;
    this.totals.costUsd += cost;

    this.assertCaps();
  }

  recordToolTurn(): void {
    this.totals.toolTurns += 1;
    this.assertCaps();
  }

  /** Snapshot for tracing / failure surfaces. Always a copy; never the live object. */
  snapshot(): UsageTotals {
    return { ...this.totals };
  }

  /** Cache-hit ratio over total billable input (cache_read + cache_create + plain input). */
  cacheHitRate(): number {
    const billable =
      this.totals.inputTokens +
      this.totals.cacheReadInputTokens +
      this.totals.cacheCreationInputTokens;
    if (billable === 0) return 0;
    return this.totals.cacheReadInputTokens / billable;
  }

  private assertCaps(): void {
    const t = this.totals;
    if (t.inputTokens > this.caps.maxInputTokens) {
      throw new BudgetExceededError(
        `input tokens ${t.inputTokens} exceeded cap ${this.caps.maxInputTokens}`,
        'maxInputTokens',
        this.snapshot(),
      );
    }
    if (t.outputTokens > this.caps.maxOutputTokens) {
      throw new BudgetExceededError(
        `output tokens ${t.outputTokens} exceeded cap ${this.caps.maxOutputTokens}`,
        'maxOutputTokens',
        this.snapshot(),
      );
    }
    if (t.toolTurns > this.caps.maxToolTurns) {
      throw new BudgetExceededError(
        `tool turns ${t.toolTurns} exceeded cap ${this.caps.maxToolTurns}`,
        'maxToolTurns',
        this.snapshot(),
      );
    }
    if (t.costUsd > this.caps.maxCostUsd) {
      throw new BudgetExceededError(
        `cost $${t.costUsd.toFixed(4)} exceeded cap $${this.caps.maxCostUsd.toFixed(2)}`,
        'maxCostUsd',
        this.snapshot(),
      );
    }
  }
}
