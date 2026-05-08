export interface ModelPricing {
  /** USD per 1M input tokens (cache-miss writes use the same rate × 1.25). */
  inputPerMTok: number;
  /** USD per 1M output tokens. */
  outputPerMTok: number;
  /** USD per 1M cache-read input tokens (typically 0.1× of input). */
  cacheReadPerMTok: number;
  /** USD per 1M cache-creation input tokens (typically 1.25× of input for 5-min TTL). */
  cacheCreatePerMTok: number;
}

/**
 * Pricing table. Numbers reflect Anthropic's published rates for the
 * Claude 4.x family at the time the LLM fallback shipped. Update when
 * pricing moves; tests pin these so a silent change can't pass CI.
 */
export const PRICING: Readonly<Record<string, ModelPricing>> = {
  'claude-sonnet-4-6': {
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    cacheReadPerMTok: 0.3,
    cacheCreatePerMTok: 3.75,
  },
  'claude-opus-4-7': {
    inputPerMTok: 15.0,
    outputPerMTok: 75.0,
    cacheReadPerMTok: 1.5,
    cacheCreatePerMTok: 18.75,
  },
  'claude-haiku-4-5-20251001': {
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    cacheReadPerMTok: 0.1,
    cacheCreatePerMTok: 1.25,
  },
};

export function priceFor(model: string): ModelPricing {
  const p = PRICING[model];
  if (!p) throw new Error(`No pricing entry for model: ${model}`);
  return p;
}
