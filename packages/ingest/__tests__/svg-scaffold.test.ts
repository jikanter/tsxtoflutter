import { describe, expect, test } from 'vitest';

import { ingest } from '../src/index.js';

const wrap = (jsx: string): string =>
  `export function Demo(){ return ${jsx}; }`;

describe('ingest: <svg> lowers to an icon scaffold', () => {
  test('emits IRElement{tag:"icon"} with a scaffold="svg" literal prop', async () => {
    const program = await ingest([
      {
        path: 'Demo.tsx',
        contents: wrap(`(
          <svg width={12} height={12} viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-6" />
          </svg>
        )`),
        kind: 'tsx',
      },
    ]);
    const body = program.components[0]?.body;
    expect(body?.kind).toBe('element');
    if (body?.kind !== 'element') throw new Error('expected element body');
    expect(body.tag).toBe('icon');
    expect(body.source.name).toBe('svg');
    expect(body.props.scaffold).toEqual({ kind: 'literal', value: 'svg' });
  });

  test('does not recurse into svg children (no `path`/`line`/etc nodes leak through)', async () => {
    const program = await ingest([
      {
        path: 'Demo.tsx',
        contents: wrap(`(
          <svg width={24} height={24}>
            <path d="M0 0L10 10" />
            <line x1="0" y1="0" x2="10" y2="10" />
          </svg>
        )`),
        kind: 'tsx',
      },
    ]);
    const body = program.components[0]?.body;
    if (body?.kind !== 'element') throw new Error('expected element body');
    expect(body.children).toEqual([]);
  });

  test('lifts width/height literal attrs into props so codegen can size the SizedBox', async () => {
    const program = await ingest([
      {
        path: 'Demo.tsx',
        contents: wrap(`<svg width={16} height={20} />`),
        kind: 'tsx',
      },
    ]);
    const body = program.components[0]?.body;
    if (body?.kind !== 'element') throw new Error('expected element body');
    expect(body.props.width).toEqual({ kind: 'literal', value: 16 });
    expect(body.props.height).toEqual({ kind: 'literal', value: 20 });
  });
});
