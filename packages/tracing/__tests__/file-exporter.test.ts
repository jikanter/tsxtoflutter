import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FileNdjsonExporter,
  readConversionTrace,
  SpanNames,
  Tracer,
} from '../src/index.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tsxf-trace-'));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('FileNdjsonExporter', () => {
  it('writes one ndjson file per conversion id and is round-trippable', async () => {
    const exporter = new FileNdjsonExporter(tmp);
    const tracer = new Tracer({
      conversionId: 'cv_round',
      exporter,
      now: clock(),
      newId: ids(),
    });
    const root = tracer.startSpan({ name: SpanNames.conversion });
    tracer.startSpan({ name: SpanNames.ingest, parent: root }).end();
    tracer.startSpan({ name: SpanNames.codegen, parent: root }).end();
    root.end();
    await tracer.flush();

    const spans = await readConversionTrace(tmp, 'cv_round');
    expect(spans.map((s) => s.name)).toEqual([SpanNames.ingest, SpanNames.codegen, SpanNames.conversion]);
    expect(spans.every((s) => s.conversionId === 'cv_round')).toBe(true);
  });

  it('appends across multiple flushes', async () => {
    const exporter = new FileNdjsonExporter(tmp);
    const tracer = new Tracer({
      conversionId: 'cv_append',
      exporter,
      now: clock(),
      newId: ids(),
    });
    tracer.startSpan({ name: SpanNames.ingest }).end();
    await tracer.flush();
    tracer.startSpan({ name: SpanNames.codegen }).end();
    await tracer.flush();

    const spans = await readConversionTrace(tmp, 'cv_append');
    expect(spans).toHaveLength(2);
  });
});

function clock(): () => number {
  let t = 0;
  return () => {
    t += 1_000_000;
    return t;
  };
}

function ids(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `s${n}`;
  };
}
