import type {
  IRComponent,
  IRElement,
  IRNode,
  IRStateDecl,
} from '@tsxtoflutter/ir';

export const COMPLEXITY_THRESHOLD = 20;
export const ESCALATE_AFTER_FAILURES = 2;

/**
 * Per-subtree complexity score per the phase-3 spec:
 *   nodeCount + (hasHooksWithEffects ? 10 : 0) + (hasCustomHook ? 5 : 0).
 *
 * Anything > THRESHOLD escalates to the LLM. Failure count from the
 * deterministic codemod is tracked separately by `decideEscalation`.
 */
export interface ComplexityScore {
  nodeCount: number;
  hasHooksWithEffects: boolean;
  hasCustomHook: boolean;
  total: number;
  /** Most-significant reasons, surfaced into traces / logs. */
  reasons: string[];
}

const KNOWN_HOOKS = new Set(['state', 'reducer', 'effect', 'context', 'memo']);

export function scoreNode(node: IRNode): ComplexityScore {
  let count = 0;
  const walk = (n: IRNode): void => {
    count += 1;
    switch (n.kind) {
      case 'element':
        for (const c of n.children) walk(c);
        return;
      case 'conditional':
        walk(n.consequent);
        if (n.alternate) walk(n.alternate);
        return;
      case 'list':
        walk(n.body);
        return;
      case 'fragment':
        for (const c of n.children) walk(c);
        return;
      case 'slot':
        for (const c of n.children) walk(c);
        return;
      case 'text':
      case 'expression':
        return;
    }
  };
  walk(node);
  const reasons: string[] = [`nodeCount=${count}`];
  return {
    nodeCount: count,
    hasHooksWithEffects: false,
    hasCustomHook: false,
    total: count,
    reasons,
  };
}

export function scoreComponent(component: IRComponent): ComplexityScore {
  const node = scoreNode(component.body);
  const state = component.state ?? [];
  const hasEffects = state.some((s: IRStateDecl) => s.kind === 'effect');
  const hasCustom = state.some((s: IRStateDecl) => !KNOWN_HOOKS.has(s.kind));
  let total = node.nodeCount + (hasEffects ? 10 : 0) + (hasCustom ? 5 : 0);

  // Unsupported markers are a strong signal we must escalate.
  const unsupportedHits = countUnsupported(component.body);
  if (unsupportedHits > 0) total += unsupportedHits * 5;

  const reasons: string[] = [...node.reasons];
  if (hasEffects) reasons.push('hasHooksWithEffects+10');
  if (hasCustom) reasons.push('hasCustomHook+5');
  if (unsupportedHits > 0) reasons.push(`unsupported×${unsupportedHits}+5each`);

  return {
    nodeCount: node.nodeCount,
    hasHooksWithEffects: hasEffects,
    hasCustomHook: hasCustom,
    total,
    reasons,
  };
}

function countUnsupported(node: IRNode): number {
  let n = 0;
  const walk = (cur: IRNode): void => {
    if (cur.kind === 'element') {
      const u = (cur as IRElement).unsupported;
      if (u && u.length > 0) n += u.length;
      for (const c of cur.children) walk(c);
    } else if (cur.kind === 'fragment' || cur.kind === 'slot') {
      for (const c of cur.children) walk(c);
    } else if (cur.kind === 'conditional') {
      walk(cur.consequent);
      if (cur.alternate) walk(cur.alternate);
    } else if (cur.kind === 'list') {
      walk(cur.body);
    }
  };
  walk(node);
  return n;
}

export interface EscalationInput {
  score: ComplexityScore;
  /** How many times the deterministic codemod has bailed on this subtree. */
  deterministicFailures: number;
}

export interface EscalationDecision {
  escalate: boolean;
  trigger: 'threshold' | 'failures' | 'none';
  reasons: string[];
}

export function decideEscalation(input: EscalationInput): EscalationDecision {
  if (input.deterministicFailures >= ESCALATE_AFTER_FAILURES) {
    return {
      escalate: true,
      trigger: 'failures',
      reasons: [
        `deterministicFailures=${input.deterministicFailures}>=${ESCALATE_AFTER_FAILURES}`,
        ...input.score.reasons,
      ],
    };
  }
  if (input.score.total > COMPLEXITY_THRESHOLD) {
    return {
      escalate: true,
      trigger: 'threshold',
      reasons: [
        `complexity=${input.score.total}>${COMPLEXITY_THRESHOLD}`,
        ...input.score.reasons,
      ],
    };
  }
  return {
    escalate: false,
    trigger: 'none',
    reasons: input.score.reasons,
  };
}
