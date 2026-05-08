import { randomBytes } from 'node:crypto';
import type {
  SpanAttributes,
  SpanEvent,
  SpanExporter,
  SpanKind,
  SpanRecord,
  SpanStatus,
} from './types.js';

export interface StartSpanOptions {
  name: string;
  kind?: SpanKind;
  attributes?: SpanAttributes;
  parent?: ActiveSpan;
}

export interface ActiveSpan {
  readonly spanId: string;
  readonly parentSpanId: string | undefined;
  readonly conversionId: string;
  setAttribute(key: string, value: string | number | boolean | null): void;
  addEvent(name: string, attributes?: SpanAttributes): void;
  setError(err: unknown): void;
  end(): void;
}

export interface TracerOptions {
  conversionId: string;
  exporter: SpanExporter;
  /** Override the now() implementation; tests inject a deterministic clock. */
  now?: () => number;
  /** Override the id factory; tests inject a deterministic generator. */
  newId?: () => string;
}

export class Tracer {
  private readonly conversionId: string;
  private readonly exporter: SpanExporter;
  private readonly now: () => number;
  private readonly newId: () => string;

  constructor(opts: TracerOptions) {
    this.conversionId = opts.conversionId;
    this.exporter = opts.exporter;
    this.now = opts.now ?? defaultNow;
    this.newId = opts.newId ?? defaultId;
  }

  startSpan(opts: StartSpanOptions): ActiveSpan {
    const startNs = this.now();
    const spanId = this.newId();
    const attributes: SpanAttributes = { ...(opts.attributes ?? {}) };
    const events: SpanEvent[] = [];
    let status: SpanStatus = 'unset';
    let error: string | undefined;
    let ended = false;
    const exporter = this.exporter;
    const now = this.now;
    const conversionId = this.conversionId;

    const span: ActiveSpan = {
      spanId,
      parentSpanId: opts.parent?.spanId,
      conversionId,
      setAttribute(key, value) {
        attributes[key] = value as SpanAttributes[string];
      },
      addEvent(name, attrs) {
        events.push({ name, timeNs: now(), attributes: { ...(attrs ?? {}) } });
      },
      setError(err) {
        status = 'error';
        error = err instanceof Error ? err.message : String(err);
      },
      end() {
        if (ended) return;
        ended = true;
        const endNs = now();
        if (status === 'unset') status = 'ok';
        const record: SpanRecord = {
          conversionId,
          spanId,
          ...(opts.parent?.spanId !== undefined ? { parentSpanId: opts.parent.spanId } : {}),
          name: opts.name,
          kind: opts.kind ?? 'internal',
          startNs,
          endNs,
          durationMs: (endNs - startNs) / 1_000_000,
          status,
          attributes,
          ...(error !== undefined ? { error } : {}),
          events,
        };
        exporter.export(record);
      },
    };
    return span;
  }

  /**
   * Run `fn` inside a span, ending it automatically. Errors are recorded on
   * the span before being re-thrown so the caller's failure path still runs.
   */
  async withSpan<T>(opts: StartSpanOptions, fn: (span: ActiveSpan) => Promise<T>): Promise<T> {
    const span = this.startSpan(opts);
    try {
      const out = await fn(span);
      return out;
    } catch (err) {
      span.setError(err);
      throw err;
    } finally {
      span.end();
    }
  }

  flush(): Promise<void> {
    return this.exporter.flush?.() ?? Promise.resolve();
  }
}

/** Stable, opaque conversion id (24 hex chars). Threaded through subprocess args + LLM logs. */
export function newConversionId(): string {
  return randomBytes(12).toString('hex');
}

function defaultNow(): number {
  // process.hrtime.bigint returns nanoseconds with high precision.
  return Number(process.hrtime.bigint());
}

function defaultId(): string {
  return randomBytes(8).toString('hex');
}
