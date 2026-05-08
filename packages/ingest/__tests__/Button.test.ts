import { describe, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { ingest } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, '../../tsx-fixtures/fixtures/Button.tsx');

describe('ingest: Button.tsx', () => {
  test('lowers the canonical Button fixture to the expected IR', async () => {
    const contents = await readFile(fixturePath, 'utf8');
    const program = await ingest([
      { path: 'Button.tsx', contents, kind: 'tsx' },
    ]);

    await expect(JSON.stringify(program, null, 2)).toMatchFileSnapshot(
      '../__snapshots__/Button.ir.json',
    );
  });

  test('produces a stable component id across re-runs', async () => {
    const contents = await readFile(fixturePath, 'utf8');
    const a = await ingest([{ path: 'Button.tsx', contents, kind: 'tsx' }]);
    const b = await ingest([{ path: 'Button.tsx', contents, kind: 'tsx' }]);
    expect(a.components[0]?.id).toBeTypeOf('string');
    expect(a.components[0]?.id).toEqual(b.components[0]?.id);
  });

  test('flags a JSX expression child as expression node', async () => {
    const contents = await readFile(fixturePath, 'utf8');
    const program = await ingest([
      { path: 'Button.tsx', contents, kind: 'tsx' },
    ]);
    const cta = program.components[0];
    expect(cta?.name).toBe('Cta');
    const body = cta?.body;
    expect(body?.kind).toBe('element');
    if (body?.kind !== 'element') return;
    expect(body.tag).toBe('button');
    const labelChild = body.children[0];
    expect(labelChild?.kind).toBe('expression');
  });
});
