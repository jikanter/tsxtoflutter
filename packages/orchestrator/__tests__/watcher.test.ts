import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createOrchestrator, type OrchestratorDeps } from '../src/watcher.js';

const FIXTURE_TSX = `import { Button } from '@/components/ui/button';

export interface CtaProps { label: string; onGo: () => void }

export function Cta({ label, onGo }: CtaProps) {
  return <Button onClick={onGo}>{label}</Button>;
}
`;

describe('orchestrator', () => {
  let workDir: string;
  let inputs: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'orch-'));
    inputs = join(workDir, 'inputs');
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  test('coalesces a burst of saves into a single codegen call', async () => {
    const codegenCalls: string[][] = [];
    const reloadCalls: string[] = [];

    const deps: OrchestratorDeps = {
      runCodegen: async (irDir, outDir) => {
        codegenCalls.push([irDir, outDir]);
        return 0;
      },
      reload: async (uri) => {
        reloadCalls.push(uri);
      },
      vmServiceUri: () => 'ws://test:1/ws',
    };

    const orch = createOrchestrator({
      patterns: inputs,
      irOutDir: join(workDir, '.tsxtoflutter/ir'),
      outDir: join(workDir, 'out'),
      flutterAppDir: workDir,
      debounceMs: 30,
      ingest: async () => ({ programs: [] }),
    }, deps);

    await orch.start();
    await orch.processChange(join(inputs, 'A.tsx'));
    await orch.processChange(join(inputs, 'A.tsx'));
    await orch.processChange(join(inputs, 'A.tsx'));
    await orch.awaitIdle();

    expect(codegenCalls).toHaveLength(1);
    expect(reloadCalls).toEqual(['ws://test:1/ws']);

    await orch.stop();
  });

  test('falls back to file-only writes when VM service is unreachable', async () => {
    const reloadAttempts: string[] = [];
    const deps: OrchestratorDeps = {
      runCodegen: async () => 0,
      reload: async (uri) => {
        reloadAttempts.push(uri);
        throw new Error('connection refused');
      },
      vmServiceUri: () => 'ws://test:1/ws',
    };

    const orch = createOrchestrator({
      patterns: inputs,
      irOutDir: join(workDir, '.tsxtoflutter/ir'),
      outDir: join(workDir, 'out'),
      flutterAppDir: workDir,
      debounceMs: 30,
      ingest: async () => ({ programs: [] }),
    }, deps);

    const warnings: string[] = [];
    orch.on('warning', (msg) => warnings.push(msg));

    await orch.start();
    await orch.processChange(join(inputs, 'A.tsx'));
    await orch.awaitIdle();

    expect(reloadAttempts).toEqual(['ws://test:1/ws']);
    expect(warnings.some((w) => /VM service unreachable/.test(w))).toBe(true);

    await orch.stop();
  });

  test('writes IR JSON for each ingested input file', async () => {
    await writeFile(join(workDir, 'A.tsx'), FIXTURE_TSX);

    const irDir = join(workDir, '.tsxtoflutter/ir');
    let codegenInvoked = false;
    const deps: OrchestratorDeps = {
      runCodegen: async () => {
        codegenInvoked = true;
        return 0;
      },
      reload: async () => {},
      vmServiceUri: () => undefined,
    };

    const orch = createOrchestrator({
      patterns: workDir,
      irOutDir: irDir,
      outDir: join(workDir, 'out'),
      flutterAppDir: workDir,
      debounceMs: 30,
      ingest: async (paths) => ({
        programs: paths.map((p) => ({
          path: p,
          json: JSON.stringify({ path: p }),
        })),
      }),
    }, deps);

    await orch.start();
    await orch.processChange(join(workDir, 'A.tsx'));
    await orch.awaitIdle();

    expect(codegenInvoked).toBe(true);
    const irFiles = await readdir(irDir);
    expect(irFiles).toContain('A.json');

    await orch.stop();
  });

  test('non-zero codegen exit surfaces as a warning event', async () => {
    const deps: OrchestratorDeps = {
      runCodegen: async () => 65,
      reload: async () => {},
      vmServiceUri: () => undefined,
    };

    const orch = createOrchestrator({
      patterns: inputs,
      irOutDir: join(workDir, '.tsxtoflutter/ir'),
      outDir: join(workDir, 'out'),
      flutterAppDir: workDir,
      debounceMs: 30,
      ingest: async () => ({ programs: [] }),
    }, deps);

    const warnings: string[] = [];
    orch.on('warning', (msg) => warnings.push(msg));

    await orch.start();
    await orch.processChange(join(inputs, 'A.tsx'));
    await orch.awaitIdle();

    expect(warnings.some((w) => /codegen exited with code 65/.test(w))).toBe(
      true,
    );

    await orch.stop();
  });
});
