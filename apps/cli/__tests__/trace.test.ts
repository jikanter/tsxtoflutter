import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FileNdjsonExporter,
  SpanNames,
  Tracer,
} from '@tsxtoflutter/tracing';
import { runTraceOpen } from '../src/commands/trace.js';

let workdir: string;
let traceDir: string;

beforeEach(async () => {
  workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsxf-trace-'));
  traceDir = path.join(workdir, 'traces');
});
afterEach(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

async function recordSampleTrace(conversionId: string): Promise<void> {
  const exporter = new FileNdjsonExporter(traceDir);
  const tracer = new Tracer({ conversionId, exporter });
  const root = tracer.startSpan({ name: SpanNames.conversion });
  const ing = tracer.startSpan({ name: SpanNames.ingest, parent: root });
  ing.setAttribute('ir.components', 1);
  ing.end();
  const cg = tracer.startSpan({ name: SpanNames.codegen, parent: root });
  cg.end();
  root.end();
  await tracer.flush();
}

describe('runTraceOpen', () => {
  it('prints span dump for a known conversion id', async () => {
    await recordSampleTrace('abcd1234abcd1234abcd1234');
    const lines: string[] = [];
    const code = await runTraceOpen(
      'abcd1234abcd1234abcd1234',
      { traceDir },
      (line) => lines.push(line),
    );
    expect(code).toBe(0);
    const joined = lines.join('\n');
    expect(joined).toContain('Conversion abcd1234abcd1234abcd1234');
    expect(joined).toContain(SpanNames.ingest);
    expect(joined).toContain('ir.components=1');
  });

  it('returns 1 when the conversion id is unknown', async () => {
    const code = await runTraceOpen(
      'doesnotexist',
      { traceDir },
      () => {
        /* no-op */
      },
    );
    expect(code).toBe(1);
  });
});
