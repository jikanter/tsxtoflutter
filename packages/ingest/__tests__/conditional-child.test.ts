import { describe, expect, test } from 'vitest';

import { ingest } from '../src/index.js';

const wrap = (jsx: string): string =>
  `export function Demo({ checked, label }: { checked: boolean; label: string }){ return ${jsx}; }`;

describe('ingest: conditional JSX children lower to IRConditional', () => {
  test('`cond && <JSX/>` becomes IRConditional with no alternate', async () => {
    const program = await ingest([
      {
        path: 'Demo.tsx',
        contents: wrap(`(
          <div>
            {checked && <svg width={12} height={12} />}
          </div>
        )`),
        kind: 'tsx',
      },
    ]);
    const body = program.components[0]?.body;
    if (body?.kind !== 'element') throw new Error('expected element body');
    expect(body.children).toHaveLength(1);
    const child = body.children[0];
    expect(child?.kind).toBe('conditional');
    if (child?.kind !== 'conditional') return;
    expect(child.test).toEqual({ kind: 'paramRef', name: 'checked' });
    expect(child.alternate).toBeUndefined();
    expect(child.consequent.kind).toBe('element');
    if (child.consequent.kind !== 'element') return;
    expect(child.consequent.tag).toBe('icon');
    expect(child.consequent.source.name).toBe('svg');
  });

  test('ternary `cond ? <A/> : <B/>` becomes IRConditional with alternate', async () => {
    const program = await ingest([
      {
        path: 'Demo.tsx',
        contents: wrap(`(
          <div>
            {checked ? <span>yes</span> : <span>no</span>}
          </div>
        )`),
        kind: 'tsx',
      },
    ]);
    const body = program.components[0]?.body;
    if (body?.kind !== 'element') throw new Error('expected element body');
    const child = body.children[0];
    expect(child?.kind).toBe('conditional');
    if (child?.kind !== 'conditional') return;
    expect(child.test).toEqual({ kind: 'paramRef', name: 'checked' });
    expect(child.consequent.kind).toBe('element');
    expect(child.alternate?.kind).toBe('element');
  });

  test('`cond ? <X/> : null` lowers to IRConditional with no alternate', async () => {
    const program = await ingest([
      {
        path: 'Demo.tsx',
        contents: wrap(`(<div>{checked ? <span>yes</span> : null}</div>)`),
        kind: 'tsx',
      },
    ]);
    const body = program.components[0]?.body;
    if (body?.kind !== 'element') throw new Error('expected element body');
    const child = body.children[0];
    expect(child?.kind).toBe('conditional');
    if (child?.kind !== 'conditional') return;
    expect(child.test).toEqual({ kind: 'paramRef', name: 'checked' });
    expect(child.consequent.kind).toBe('element');
    expect(child.alternate).toBeUndefined();
  });

  test('non-JSX RHS of `&&` still falls through to plain expression child', async () => {
    // `checked && label` is a value-returning ternary-ish — not JSX. The
    // existing behavior (emit as expression child) is correct here; the new
    // path must not greedily swallow it.
    const program = await ingest([
      {
        path: 'Demo.tsx',
        contents: wrap(`(<div>{checked && label}</div>)`),
        kind: 'tsx',
      },
    ]);
    const body = program.components[0]?.body;
    if (body?.kind !== 'element') throw new Error('expected element body');
    expect(body.children[0]?.kind).toBe('expression');
  });
});
