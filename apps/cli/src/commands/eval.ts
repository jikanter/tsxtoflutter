/**
 * `tsxf eval --corpus <dir>` — Phase-3 quality gate.
 *
 * Walks the fixture corpus, runs ingest, and applies a layered set of gates:
 *   1. ingest succeeds (always run; pure JS)
 *   2. complexity score recorded
 *   3. dart analyze (skipped if `dart` is missing on PATH; CI is strict)
 *   4. dart format --set-exit-if-changed (skipped if `dart` is missing)
 *
 * The output `eval-results.json` carries per-fixture pass/fail, complexity,
 * gate timings, and rolled-up totals. `tsxf eval` exits non-zero if any
 * fixture's mandatory gates fail; missing `dart` is non-fatal but flagged.
 */
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { ingest, localComplexity, type InputFile } from '@tsxtoflutter/ingest';
import {
  FileNdjsonExporter,
  newConversionId,
  SpanNames,
  Tracer,
  type SpanRecord,
} from '@tsxtoflutter/tracing';

export interface EvalOptions {
  corpusDir: string;
  outFile: string;
  traceDir: string;
  /** Override `dart` binary path; defaults to PATH lookup. */
  dartBin?: string;
  /** Optional override of process.cwd. */
  cwd?: string;
}

export interface FixtureResult {
  file: string;
  conversionId: string;
  components: { id: string; name: string; complexity: number }[];
  ingest: GateResult;
  dartAnalyze?: GateResult;
  dartFormat?: GateResult;
  /** Mandatory gate failure -> overall failure. */
  passed: boolean;
}

export interface GateResult {
  status: 'pass' | 'fail' | 'skipped';
  durationMs: number;
  message?: string;
}

export interface EvalScorecard {
  corpusDir: string;
  totalFixtures: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  fixtures: FixtureResult[];
  /** Whether dart was available on this run (drives skip status). */
  dartAvailable: boolean;
}

export async function runEval(opts: EvalOptions): Promise<number> {
  const startedAt = Date.now();
  const cwd = opts.cwd ?? process.cwd();
  const dartBin = opts.dartBin ?? 'dart';
  const dartAvailable = await isOnPath(dartBin);

  const fixtures = await listFixtures(opts.corpusDir);
  if (fixtures.length === 0) {
    process.stderr.write(`tsxf eval: no .tsx fixtures found under ${opts.corpusDir}\n`);
    return 1;
  }

  const exporter = new FileNdjsonExporter(opts.traceDir);
  const results: FixtureResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const file of fixtures) {
    const conversionId = newConversionId();
    const tracer = new Tracer({ conversionId, exporter });
    const fixtureResult = await runOneFixture({
      file,
      conversionId,
      tracer,
      cwd,
      dartBin,
      dartAvailable,
    });
    await tracer.flush();
    results.push(fixtureResult);
    if (fixtureResult.passed) passed += 1;
    else failed += 1;
  }

  const scorecard: EvalScorecard = {
    corpusDir: opts.corpusDir,
    totalFixtures: fixtures.length,
    passed,
    failed,
    skipped: 0,
    durationMs: Date.now() - startedAt,
    fixtures: results,
    dartAvailable,
  };
  await fs.mkdir(path.dirname(opts.outFile), { recursive: true });
  await fs.writeFile(opts.outFile, JSON.stringify(scorecard, null, 2));

  process.stdout.write(formatSummary(scorecard) + '\n');
  return failed > 0 ? 1 : 0;
}

interface RunOneFixtureInput {
  file: string;
  conversionId: string;
  tracer: Tracer;
  cwd: string;
  dartBin: string;
  dartAvailable: boolean;
}

async function runOneFixture(input: RunOneFixtureInput): Promise<FixtureResult> {
  const { file, conversionId, tracer, cwd, dartBin, dartAvailable } = input;
  const root = tracer.startSpan({
    name: SpanNames.conversion,
    attributes: { 'fixture.path': path.relative(cwd, file) },
  });

  // ─── ingest gate ──────────────────────────────────────────────────────
  const ingestStart = Date.now();
  const ingestSpan = tracer.startSpan({ name: SpanNames.ingest, parent: root });
  let ingestResult: GateResult;
  let components: FixtureResult['components'] = [];
  try {
    const contents = await fs.readFile(file, 'utf8');
    const inputs: InputFile[] = [{ path: path.relative(cwd, file), contents, kind: 'tsx' }];
    const program = await ingest(inputs);
    components = program.components.map((c) => ({
      id: c.id,
      name: c.name,
      complexity: localComplexity(c),
    }));
    ingestSpan.setAttribute('ir.components', program.components.length);
    ingestSpan.setAttribute('ir.diagnostics', program.diagnostics.length);
    ingestResult = { status: 'pass', durationMs: Date.now() - ingestStart };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ingestSpan.setError(err);
    ingestResult = { status: 'fail', durationMs: Date.now() - ingestStart, message };
  } finally {
    ingestSpan.end();
  }

  // Bail early if ingest failed; downstream gates have nothing to chew on.
  if (ingestResult.status === 'fail') {
    root.setAttribute('result', 'fail');
    root.end();
    return {
      file: path.relative(cwd, file),
      conversionId,
      components,
      ingest: ingestResult,
      passed: false,
    };
  }

  // ─── dart analyze + format gates ──────────────────────────────────────
  let dartAnalyze: GateResult | undefined;
  let dartFormat: GateResult | undefined;
  if (dartAvailable) {
    // Use the Dart codegen via subprocess in a future iteration; for Phase 3
    // we run analyzer/format on whatever the previous convert step produced
    // under flutter_app/lib/components. If no Dart files exist for this
    // fixture yet, both gates skip rather than fail (codegen wiring lands in
    // R4-step-2 alongside the corpus expansion).
    const componentName = pickComponentName(components, file);
    const dartFile = await locateGeneratedDart(cwd, componentName);
    if (dartFile) {
      const analyzeSpan = tracer.startSpan({
        name: 'gate.dart_analyze',
        kind: 'client',
        parent: root,
        attributes: { 'fixture.dart': path.relative(cwd, dartFile) },
      });
      try {
        dartAnalyze = await runDart(dartBin, ['analyze', dartFile], cwd);
      } finally {
        analyzeSpan.end();
      }
      const formatSpan = tracer.startSpan({
        name: 'gate.dart_format',
        kind: 'client',
        parent: root,
      });
      try {
        dartFormat = await runDart(
          dartBin,
          ['format', '--set-exit-if-changed', '--output=none', dartFile],
          cwd,
        );
      } finally {
        formatSpan.end();
      }
    } else {
      dartAnalyze = { status: 'skipped', durationMs: 0, message: 'no generated Dart found' };
      dartFormat = { status: 'skipped', durationMs: 0, message: 'no generated Dart found' };
    }
  } else {
    dartAnalyze = { status: 'skipped', durationMs: 0, message: 'dart not on PATH' };
    dartFormat = { status: 'skipped', durationMs: 0, message: 'dart not on PATH' };
  }

  const passed =
    ingestResult.status === 'pass' &&
    (dartAnalyze?.status !== 'fail') &&
    (dartFormat?.status !== 'fail');
  root.setAttribute('result', passed ? 'pass' : 'fail');
  root.end();

  const result: FixtureResult = {
    file: path.relative(cwd, file),
    conversionId,
    components,
    ingest: ingestResult,
    passed,
  };
  if (dartAnalyze !== undefined) result.dartAnalyze = dartAnalyze;
  if (dartFormat !== undefined) result.dartFormat = dartFormat;
  return result;
}

function pickComponentName(
  components: FixtureResult['components'],
  fixturePath: string,
): string {
  if (components.length > 0 && components[0]) return components[0].name;
  return path.basename(fixturePath, path.extname(fixturePath));
}

async function locateGeneratedDart(cwd: string, componentName: string): Promise<string | undefined> {
  const candidates = [
    path.join(cwd, 'flutter_app', 'lib', 'components', `${snakeCase(componentName)}.dart`),
    path.join(cwd, 'flutter_app', 'lib', 'components', `${componentName.toLowerCase()}.dart`),
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      /* keep looking */
    }
  }
  return undefined;
}

function snakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

async function listFixtures(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) await walk(fp);
      else if (e.isFile() && e.name.endsWith('.tsx')) out.push(fp);
    }
  }
  try {
    await walk(dir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw err;
  }
  out.sort();
  return out;
}

async function isOnPath(bin: string): Promise<boolean> {
  return new Promise((resolveExit) => {
    const child = spawn(bin, ['--version'], { stdio: 'ignore' });
    child.on('error', () => resolveExit(false));
    child.on('exit', (code) => resolveExit(code === 0));
  });
}

async function runDart(bin: string, args: string[], cwd: string): Promise<GateResult> {
  return new Promise((resolveExit) => {
    const start = Date.now();
    const child = spawn(bin, args, { cwd });
    let stderr = '';
    let stdout = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err) =>
      resolveExit({
        status: 'fail',
        durationMs: Date.now() - start,
        message: err.message,
      }),
    );
    child.on('exit', (code) => {
      const durationMs = Date.now() - start;
      if (code === 0) {
        resolveExit({ status: 'pass', durationMs });
      } else {
        const msg = (stderr || stdout || `exit ${code}`).trim().slice(0, 500);
        resolveExit({ status: 'fail', durationMs, message: msg });
      }
    });
  });
}

function formatSummary(card: EvalScorecard): string {
  const lines = [
    `tsxf eval — ${card.totalFixtures} fixture(s) in ${card.durationMs}ms`,
    `  passed: ${card.passed}`,
    `  failed: ${card.failed}`,
  ];
  if (!card.dartAvailable) {
    lines.push('  note: dart not on PATH — analyze/format gates skipped');
  }
  return lines.join('\n');
}

/** Re-exported for test injection. */
export const __test__ = { listFixtures, snakeCase };
export type { SpanRecord };
