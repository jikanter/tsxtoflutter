import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runEval, type EvalScorecard } from '../src/commands/eval.js';

let workdir: string;

beforeEach(async () => {
  workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsxf-eval-'));
});
afterEach(async () => {
  await fs.rm(workdir, { recursive: true, force: true });
});

async function writeFixture(name: string, contents: string): Promise<string> {
  const dir = path.join(workdir, 'fixtures');
  await fs.mkdir(dir, { recursive: true });
  const fp = path.join(dir, name);
  await fs.writeFile(fp, contents);
  return fp;
}

const TINY = `export interface TestProps { label: string; }
export function Test({ label }: TestProps) {
  return <span>{label}</span>;
}
`;

describe('runEval', () => {
  it('returns 1 when corpus is empty', async () => {
    const code = await runEval({
      corpusDir: path.join(workdir, 'empty'),
      outFile: path.join(workdir, 'eval-results.json'),
      traceDir: path.join(workdir, 'traces'),
      cwd: workdir,
      dartBin: '/usr/bin/false',
    });
    expect(code).toBe(1);
  });

  it('writes a scorecard with per-fixture results', async () => {
    await writeFixture('Test.tsx', TINY);
    const out = path.join(workdir, 'eval-results.json');
    const code = await runEval({
      corpusDir: path.join(workdir, 'fixtures'),
      outFile: out,
      traceDir: path.join(workdir, 'traces'),
      cwd: workdir,
      dartBin: '/usr/bin/false', // forces dart-skip path
    });
    expect(code).toBe(0);
    const card = JSON.parse(await fs.readFile(out, 'utf8')) as EvalScorecard;
    expect(card.totalFixtures).toBe(1);
    expect(card.passed).toBe(1);
    expect(card.failed).toBe(0);
    expect(card.dartAvailable).toBe(false);
    expect(card.fixtures[0]?.ingest.status).toBe('pass');
    expect(card.fixtures[0]?.dartAnalyze?.status).toBe('skipped');
    expect(card.fixtures[0]?.components.length).toBeGreaterThan(0);
    expect(card.fixtures[0]?.conversionId).toMatch(/^[0-9a-f]{24}$/);
  });

  it('writes per-conversion ndjson traces', async () => {
    await writeFixture('Test.tsx', TINY);
    const traceDir = path.join(workdir, 'traces');
    await runEval({
      corpusDir: path.join(workdir, 'fixtures'),
      outFile: path.join(workdir, 'eval-results.json'),
      traceDir,
      cwd: workdir,
      dartBin: '/usr/bin/false',
    });
    const files = await fs.readdir(traceDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/\.ndjson$/);
    const ndjson = await fs.readFile(path.join(traceDir, files[0]!), 'utf8');
    const lines = ndjson.trim().split('\n');
    expect(lines.length).toBeGreaterThan(0);
    const span = JSON.parse(lines[0]!);
    expect(span.conversionId).toMatch(/^[0-9a-f]{24}$/);
    expect(typeof span.name).toBe('string');
  });

  it('reports failure (exit 1) when ingest fails on a fixture', async () => {
    await writeFixture('Bad.tsx', '<<<not valid tsx>>>');
    const code = await runEval({
      corpusDir: path.join(workdir, 'fixtures'),
      outFile: path.join(workdir, 'eval-results.json'),
      traceDir: path.join(workdir, 'traces'),
      cwd: workdir,
      dartBin: '/usr/bin/false',
    });
    expect(code).toBe(1);
    const card = JSON.parse(
      await fs.readFile(path.join(workdir, 'eval-results.json'), 'utf8'),
    ) as EvalScorecard;
    expect(card.failed).toBe(1);
    expect(card.fixtures[0]?.ingest.status).toBe('fail');
  });
});
