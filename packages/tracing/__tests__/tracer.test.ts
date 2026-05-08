import { describe, expect, it } from 'vitest';
import {
  MemoryExporter,
  newConversionId,
  SpanNames,
  StdoutJsonExporter,
  Tracer,
} from '../src/index.js';

function fixedClock(): () => number {
  let t = 0;
  return () => {
    t += 1_000_000; // +1ms each call
    return t;
  };
}

describe('Tracer', () => {
  it('exports a span on end with attributes and duration', () => {
    const exporter = new MemoryExporter();
    const tracer = new Tracer({
      conversionId: 'cv_test',
      exporter,
      now: fixedClock(),
      newId: idFactory(),
    });
    const span = tracer.startSpan({
      name: SpanNames.ingest,
      attributes: { 'ir.components': 1 },
    });
    span.setAttribute('ir.input.file', 'Button.tsx');
    span.addEvent('parsed', { 'parse.kind': 'tsx' });
    span.end();

    expect(exporter.spans).toHaveLength(1);
    const s = exporter.spans[0]!;
    expect(s.conversionId).toBe('cv_test');
    expect(s.name).toBe('ingest');
    expect(s.status).toBe('ok');
    expect(s.attributes['ir.components']).toBe(1);
    expect(s.attributes['ir.input.file']).toBe('Button.tsx');
    expect(s.events[0]?.name).toBe('parsed');
    expect(s.durationMs).toBeGreaterThan(0);
  });

  it('records errors and rethrows from withSpan', async () => {
    const exporter = new MemoryExporter();
    const tracer = new Tracer({
      conversionId: 'cv_err',
      exporter,
      now: fixedClock(),
      newId: idFactory(),
    });
    await expect(
      tracer.withSpan({ name: SpanNames.translate }, async () => {
        throw new Error('budget exceeded');
      }),
    ).rejects.toThrow(/budget exceeded/);

    expect(exporter.spans[0]?.status).toBe('error');
    expect(exporter.spans[0]?.error).toBe('budget exceeded');
  });

  it('threads parent-child relationships', () => {
    const exporter = new MemoryExporter();
    const tracer = new Tracer({
      conversionId: 'cv_parent',
      exporter,
      now: fixedClock(),
      newId: idFactory(),
    });
    const root = tracer.startSpan({ name: SpanNames.conversion });
    const child = tracer.startSpan({ name: SpanNames.ingest, parent: root });
    child.end();
    root.end();

    expect(exporter.spans[0]?.parentSpanId).toBe(root.spanId);
    expect(exporter.spans[1]?.parentSpanId).toBeUndefined();
  });

  it('end() is idempotent', () => {
    const exporter = new MemoryExporter();
    const tracer = new Tracer({
      conversionId: 'cv_idem',
      exporter,
      now: fixedClock(),
      newId: idFactory(),
    });
    const s = tracer.startSpan({ name: SpanNames.ingest });
    s.end();
    s.end();
    expect(exporter.spans).toHaveLength(1);
  });
});

describe('StdoutJsonExporter', () => {
  it('writes one JSON object per line', () => {
    const lines: string[] = [];
    const exporter = new StdoutJsonExporter((line) => lines.push(line));
    const tracer = new Tracer({
      conversionId: 'cv_x',
      exporter,
      now: fixedClock(),
      newId: idFactory(),
    });
    tracer.startSpan({ name: SpanNames.codegen }).end();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(lines[0]!.trim());
    expect(parsed.name).toBe('codegen');
  });
});

describe('newConversionId', () => {
  it('returns a stable opaque hex string', () => {
    const a = newConversionId();
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(a).not.toBe(newConversionId());
  });
});

function idFactory(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `span_${n.toString().padStart(2, '0')}`;
  };
}
