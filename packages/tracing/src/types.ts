/**
 * OTel-shaped types. We intentionally don't pull in `@opentelemetry/api` in
 * Phase 3 — the runtime exporter is just stdout JSON, and we want to keep the
 * dep graph small. Phase 5 swaps the exporter for Langfuse / OTLP without
 * changing this surface.
 */

export type SpanStatus = 'unset' | 'ok' | 'error';

export type SpanKind =
  /** Cross-cutting orchestration spans (the conversion as a whole). */
  | 'internal'
  /** External calls — LLM, subprocess. */
  | 'client'
  /** Tool implementations the LLM invokes. */
  | 'tool';

export interface SpanAttributes {
  [key: string]: string | number | boolean | null | undefined;
}

export interface SpanRecord {
  conversionId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startNs: number;
  endNs: number;
  durationMs: number;
  status: SpanStatus;
  attributes: SpanAttributes;
  /** Error message when status==='error'. */
  error?: string;
  /** Nested events (logs) attached to the span. */
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timeNs: number;
  attributes: SpanAttributes;
}

export interface SpanExporter {
  export(span: SpanRecord): void;
  flush?(): Promise<void>;
}
