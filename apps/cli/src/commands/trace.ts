import path from 'node:path';
import { readConversionTrace, type SpanRecord } from '@tsxtoflutter/tracing';

export interface TraceOpenOptions {
  traceDir: string;
}

/**
 * Phase 3 prints the local span dump for `<conversion-id>`. Phase 5 will
 * deep-link into the Langfuse UI; the seam is the same. Returns the process
 * exit code so the caller can `process.exit(code)`.
 */
export async function runTraceOpen(
  conversionId: string,
  opts: TraceOpenOptions,
  out: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
): Promise<number> {
  const dir = path.resolve(opts.traceDir);
  let spans: SpanRecord[];
  try {
    spans = await readConversionTrace(dir, conversionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`No trace found for ${conversionId} in ${dir}: ${message}\n`);
    return 1;
  }
  if (spans.length === 0) {
    out(`No spans recorded for ${conversionId}.`);
    return 0;
  }

  out(`Conversion ${conversionId} — ${spans.length} span(s)`);
  out('');
  // Sort by startNs so the dump reads top-to-bottom.
  const sorted = [...spans].sort((a, b) => a.startNs - b.startNs);
  for (const s of sorted) {
    const status =
      s.status === 'error' ? `ERROR (${s.error ?? 'no message'})` : s.status.toUpperCase();
    out(
      `  [${s.kind}] ${s.name}  ${s.durationMs.toFixed(2)}ms  ${status}`,
    );
    for (const [k, v] of Object.entries(s.attributes)) {
      out(`      ${k}=${formatVal(v)}`);
    }
    for (const ev of s.events) {
      out(`      · event: ${ev.name}`);
    }
  }
  return 0;
}

function formatVal(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  return String(v);
}
