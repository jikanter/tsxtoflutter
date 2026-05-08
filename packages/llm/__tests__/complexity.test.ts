import { describe, expect, it } from 'vitest';
import type { IRComponent, IRElement, IRNode } from '@tsxtoflutter/ir';
import {
  COMPLEXITY_THRESHOLD,
  decideEscalation,
  scoreComponent,
  scoreNode,
} from '../src/complexity.js';

function el(children: IRNode[] = []): IRElement {
  return {
    kind: 'element',
    tag: 'box',
    source: { name: 'div', loc: { file: 'x', line: 1, col: 0 } },
    style: {},
    props: {},
    events: [],
    children,
  };
}

function comp(body: IRNode, state: IRComponent['state'] = []): IRComponent {
  const out: IRComponent = {
    kind: 'component',
    id: 'id',
    name: 'C',
    source: { file: 'x', line: 1, col: 0 },
    params: [],
    body,
  };
  if (state && state.length > 0) out.state = state;
  return out;
}

describe('scoreNode', () => {
  it('counts a leaf as 1', () => {
    expect(scoreNode(el()).total).toBe(1);
  });

  it('counts every descendant', () => {
    const tree = el([el([el(), el()]), el()]);
    expect(scoreNode(tree).total).toBe(5);
  });
});

describe('scoreComponent', () => {
  it('adds +10 for effects and +5 for custom hooks', () => {
    const c = comp(el(), [
      { kind: 'effect', name: 'fx' },
      { kind: 'state', name: 's' },
    ]);
    expect(scoreComponent(c).total).toBe(11);
  });

  it('adds +5 per unsupported marker', () => {
    const node: IRElement = {
      ...el(),
      unsupported: [{ feature: 'createPortal' }, { feature: 'useImperativeHandle' }],
    };
    const c = comp(node);
    expect(scoreComponent(c).total).toBe(1 + 2 * 5);
  });
});

describe('decideEscalation', () => {
  it('escalates when complexity > threshold', () => {
    const score = scoreNode(makeBigTree(COMPLEXITY_THRESHOLD + 5));
    const decision = decideEscalation({ score, deterministicFailures: 0 });
    expect(decision.escalate).toBe(true);
    expect(decision.trigger).toBe('threshold');
  });

  it('escalates after 2 deterministic failures even with simple subtree', () => {
    const score = scoreNode(el());
    const decision = decideEscalation({ score, deterministicFailures: 2 });
    expect(decision.escalate).toBe(true);
    expect(decision.trigger).toBe('failures');
  });

  it('does not escalate small + zero failures', () => {
    const score = scoreNode(el([el(), el()]));
    const decision = decideEscalation({ score, deterministicFailures: 0 });
    expect(decision.escalate).toBe(false);
  });
});

function makeBigTree(n: number): IRElement {
  let cur = el();
  for (let i = 1; i < n; i++) cur = el([cur]);
  return cur;
}
