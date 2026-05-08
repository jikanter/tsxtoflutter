/**
 * Decides whether a given IR component should be lowered by the deterministic
 * codemod or escalated to the LLM fallback. This is the policy seam described
 * in phase-3.md R2 — kept separate from the actual LLM call so the policy can
 * be unit-tested without spinning up a real model.
 */

import type { IRComponent } from '@tsxtoflutter/ir';

export interface EscalationPolicyResult {
  escalate: boolean;
  trigger: 'threshold' | 'failures' | 'none';
  reasons: string[];
}

export interface DecideOptions {
  /** Failure count fed back from prior deterministic-codemod attempts. */
  deterministicFailures: number;
  /** Override the complexity threshold; defaults to spec value (20). */
  threshold?: number;
}

const DEFAULT_THRESHOLD = 20;
const ESCALATE_AFTER_FAILURES = 2;

/**
 * Local copy of the complexity scorer that does NOT depend on `@tsxtoflutter/llm`.
 * Lets `decide()` stay pure for ingest-level tests; the production hot path
 * imports the canonical scorer from the llm package and routes through this.
 */
export function localComplexity(component: IRComponent): number {
  let nodes = 0;
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    nodes += 1;
    const obj = n as { kind?: string; children?: unknown[]; consequent?: unknown; alternate?: unknown; body?: unknown };
    if (Array.isArray(obj.children)) for (const c of obj.children) walk(c);
    if (obj.consequent !== undefined) walk(obj.consequent);
    if (obj.alternate !== undefined) walk(obj.alternate);
    if (obj.body !== undefined && typeof obj.body === 'object') walk(obj.body);
  };
  walk(component.body);

  const state = component.state ?? [];
  let total = nodes;
  if (state.some((s) => s.kind === 'effect')) total += 10;
  if (state.some((s) => !['state', 'reducer', 'effect', 'context', 'memo'].includes(s.kind))) {
    total += 5;
  }
  return total;
}

export function decide(
  component: IRComponent,
  opts: DecideOptions,
): EscalationPolicyResult {
  const reasons: string[] = [];
  if (opts.deterministicFailures >= ESCALATE_AFTER_FAILURES) {
    reasons.push(`deterministicFailures=${opts.deterministicFailures}>=${ESCALATE_AFTER_FAILURES}`);
    return { escalate: true, trigger: 'failures', reasons };
  }
  const score = localComplexity(component);
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  reasons.push(`complexity=${score}`);
  if (score > threshold) {
    reasons.push(`>${threshold}`);
    return { escalate: true, trigger: 'threshold', reasons };
  }
  return { escalate: false, trigger: 'none', reasons };
}
