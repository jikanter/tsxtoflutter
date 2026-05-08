import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { SpanExporter, SpanRecord } from './types.js';

/** Phase-3 default. One JSON object per line, written to stdout. */
export class StdoutJsonExporter implements SpanExporter {
  constructor(private readonly write: (line: string) => void = (line) => process.stdout.write(line)) {}
  export(span: SpanRecord): void {
    this.write(`${JSON.stringify(span)}\n`);
  }
}

/**
 * Captures spans in memory. Useful for tests and for `tsxf trace open
 * <conversion-id>` which dumps the local trace file.
 */
export class MemoryExporter implements SpanExporter {
  public readonly spans: SpanRecord[] = [];
  export(span: SpanRecord): void {
    this.spans.push(span);
  }
}

/**
 * Writes spans to `<traceDir>/<conversionId>.ndjson` so `tsxf trace open` can
 * load them later. Each conversion gets its own file; appending is safe across
 * concurrent processes (subprocess codegen + watcher).
 */
export class FileNdjsonExporter implements SpanExporter {
  constructor(
    private readonly traceDir: string,
    private readonly fsImpl: typeof fs = fs,
  ) {}

  private buffer: SpanRecord[] = [];

  export(span: SpanRecord): void {
    this.buffer.push(span);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const grouped = new Map<string, SpanRecord[]>();
    for (const span of this.buffer) {
      const key = span.conversionId;
      const list = grouped.get(key) ?? [];
      list.push(span);
      grouped.set(key, list);
    }
    this.buffer = [];
    await this.fsImpl.mkdir(this.traceDir, { recursive: true });
    for (const [conversionId, spans] of grouped) {
      const fp = path.join(this.traceDir, `${conversionId}.ndjson`);
      const body = spans.map((s) => JSON.stringify(s)).join('\n') + '\n';
      await this.fsImpl.appendFile(fp, body, 'utf8');
    }
  }
}

/** Read a previously-written conversion trace file. */
export async function readConversionTrace(
  traceDir: string,
  conversionId: string,
): Promise<SpanRecord[]> {
  const fp = path.join(traceDir, `${conversionId}.ndjson`);
  const text = await fs.readFile(fp, 'utf8');
  return text
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as SpanRecord);
}
