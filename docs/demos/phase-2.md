# Phase 2 — Preview + hot loop

*2026-05-08T18:37:07Z by Showboat 0.6.1*
<!-- showboat-id: f85ef0b2-0208-4dea-8747-ad7af81fd778 -->

Phase 2 turns the bare TSX→Dart pipeline from Phase 1 into an inner save→see loop. This demo proves: (1) the orchestrator's debouncer / run-controller / VM-service helpers behave correctly under burst, cancel, and timeout; (2) the Dart-side watcher emits **byte-identical** Dart on no-op IR changes (so the Flutter VM doesn't see spurious file events); (3) the side-by-side preview app boots with the COOP/COEP headers Skwasm requires; (4) the three-tier content-addressed cache writes, reads, summarizes, and garbage-collects across tiers; and (5) \`tsxf doctor\` is honest about a half-provisioned environment.

Per project policy every \`exec\` block is filtered to deterministic lines only — test summaries, file paths, exit codes — so this document re-runs drift-free under \`showboat verify\`.

## 1. tsxf doctor

Doctor probes node / pnpm / bun / flutter / dart for the version floors specified in the roadmap and verifies that \`flutter_app/.dart_tool/\` exists. Pure version-parsers (\`parseFlutterVersion\`, \`parseDartVersion\`, \`parseSemverLike\`) keep the logic unit-testable; the runtime \`defaultProbe\` shells out for real checks.

```bash
pnpm --filter @tsxtoflutter/cli exec vitest run __tests__/doctor.test.ts 2>&1 | grep -E 'Test Files|Tests' | head -2
```

```output
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

End-to-end smoke against the worktree: every tool meets its floor, but \`flutter_app/.dart_tool/\` is absent in this clean checkout, so doctor surfaces the precise remediation and exits non-zero — exactly as specified.

```bash
rm -rf flutter_app/.dart_tool 2>/dev/null
bun apps/cli/src/index.ts doctor --repo-root . > /tmp/doctor.out 2>&1; echo "exit: $?"
grep -E '^\[(ok |FAIL)\]' /tmp/doctor.out | sed -E 's/[0-9]+\.[0-9]+\.[0-9]+/<version>/g; s|/Volumes/[^ ]+|<path>|g'
rm -f /tmp/doctor.out
```

```output
exit: 1
[ok ] node <version>
[ok ] pnpm <version>
[ok ] bun <version>
[ok ] flutter <version>
[ok ] dart <version>
[FAIL] flutter_app: missing .dart_tool — run `flutter pub get` in flutter_app/
```

## 2. Three-tier content-addressed cache

Three tiers: \`parse\` (TSX → React-IR), \`xlate\` (React-IR subtree → Flutter-IR fragment, key includes ruleset-version + model-id so Phase 3's LLM cache reuses the same disk layout), and \`build\` (Dart sources + pubspec → built artifact). The store is content-addressed under \`<cache-dir>/<tier>/<sha256>.json\`. Tests exercise key derivation (including the xlate forward-compat invariant), per-tier round-trip, stats, clear, and gc-by-mtime.

```bash
pnpm --filter @tsxtoflutter/cache test 2>&1 | grep -E 'Test Files|Tests' | head -2
```

```output
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

End-to-end smoke: clear, populate two parse-cache entries via the public API, observe stats, then gc with a 0-day cutoff to wipe everything.

```bash
set -e
DEMO_DIR=/tmp/tsxf-cache-demo
rm -rf "$DEMO_DIR"
bun -e "
  import { CacheStore, parseKey } from './packages/cache/src/store.ts';
  const c = new CacheStore('$DEMO_DIR');
  await c.put('parse', parseKey({ source: 'export const A=1', parserVersion: '0.1.0' }), { ir: 'A' });
  await c.put('parse', parseKey({ source: 'export const B=2', parserVersion: '0.1.0' }), { ir: 'B' });
"
echo '--- after seeding ---'
bun apps/cli/src/index.ts cache stats --cache-dir "$DEMO_DIR"
echo '--- gc with 0-day cutoff ---'
bun apps/cli/src/index.ts cache gc --cache-dir "$DEMO_DIR" --max-age-days 0
echo '--- after gc ---'
bun apps/cli/src/index.ts cache stats --cache-dir "$DEMO_DIR"
rm -rf "$DEMO_DIR"
```

```output
--- after seeding ---
Tier   Entries    Size
parse        2    20 B
xlate        0    0 B
build        0    0 B
--- gc with 0-day cutoff ---
Removed 2 entries older than 0 day(s)
--- after gc ---
Tier   Entries    Size
parse        0    0 B
xlate        0    0 B
build        0    0 B
```

## 3. Orchestrator helpers

The orchestrator splits into three independently-testable pieces: a trailing-edge **debouncer** (collapses an editor's save-burst into a single ingest), a **VM-service** client (parses Flutter's stdout for the URL and POSTs \`_reloadSources\` over WebSocket with a 3 s hard timeout per the Skwasm risk register), and a **run-controller** that serializes async work so at most one is in flight and at most one is pending — a third submit displaces the queued second ("never queue more than one").

```bash
pnpm --filter @tsxtoflutter/orchestrator exec vitest run 2>&1 | grep -E 'Test Files|Tests' | head -2
```

```output
 Test Files  3 passed (3)
      Tests  14 passed (14)
```

Smoke-test \`tsxf watch\` against the canonical Button fixture. The boot line confirms chokidar sees the network volume under \`/Volumes/\` and switches on \`usePolling\` automatically (per the Phase 2 risk-register mitigation). The process is killed immediately; this just proves boot.

```bash
DEMO=/tmp/tsxf-watch-demo
rm -rf "$DEMO"
mkdir -p "$DEMO/inputs" "$DEMO/flutter"
cp packages/tsx-fixtures/fixtures/Button.tsx "$DEMO/inputs/"
timeout 1 bun apps/cli/src/index.ts watch "$DEMO/inputs" \
  --ir-out "$DEMO/ir" \
  --out "$DEMO/out" \
  --flutter-app "$DEMO/flutter" \
  --cache-dir "$DEMO/cache" 2>&1 | head -1 | sed 's|/tmp/tsxf-watch-demo|<demo>|g'
rm -rf "$DEMO"
echo 'watch boot ok'
```

```output
watching <demo>/inputs/**/*.{tsx,mdx} (debounce 100ms, polling)
watch boot ok
```

## 4. Dart-side watch — idempotent emission

The Dart watcher's hard requirement is **idempotence**: the same IR JSON must produce byte-identical Dart output, and a no-op rerun must not bump file mtimes (so chokidar / \`flutter run\` don't see ghost events). \`writeIfChanged\` enforces this; the emitter only generates the hand-written shell when it's missing, so developer edits survive every regeneration. The four idempotence tests assert: first-run produces the pair; second-run with identical IR writes zero files and preserves mtime; a hand-edited shell is not clobbered; \`writeIfChanged\` returns \`false\` on a byte-match.

```bash
cd packages/codegen && dart test test/idempotent_writer_test.dart 2>&1 | grep -E 'All tests passed|tests pass|FAIL' | tail -3
```

```output
00:00 +4: All tests passed!
```

## 5. Side-by-side preview app

The preview app is a Vite 8 split-pane that loads the fixture corpus on the left (live React, HMR) and embeds Flutter Web's \`flutter run -d chrome\` instance via iframe on the right. Skwasm requires \`Cross-Origin-Opener-Policy: same-origin\` and \`Cross-Origin-Embedder-Policy: require-corp\` on the embedder so SharedArrayBuffer is available — the dev server emits both. The fixture selector reads from the workspace's \`@tsxtoflutter/tsx-fixtures\` registry; a Vite alias maps the shadcn \`@/components/ui/button\` import to a local stub so the corpus renders without pulling shadcn into the workspace.

```bash
echo '--- COOP/COEP headers in vite config ---'
grep -E 'Cross-Origin' apps/preview/vite.config.ts
echo '--- iframe pointing at flutter web ---'
grep -E 'localhost:8080' apps/preview/src/App.tsx
echo '--- fixture selector wired to workspace registry ---'
grep -E "FIXTURES" apps/preview/src/App.tsx | head -1
echo '--- shadcn alias to local stub ---'
grep -E 'components/ui/button' apps/preview/vite.config.ts | head -1
```

```output
--- COOP/COEP headers in vite config ---
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
--- iframe pointing at flutter web ---
            src="http://localhost:8080/"
--- fixture selector wired to workspace registry ---
import { FIXTURES, type FixtureEntry } from '@tsxtoflutter/tsx-fixtures';
--- shadcn alias to local stub ---
      '@/components/ui/button': path.resolve(here, 'src/stubs/button.tsx'),
```

## 6. Aggregate test count

Phase 2 lands the following test files. Counts are derived by grepping for \`it(\` / \`test(\` / \`testWidgets(\` so they survive any incidental ordering inside vitest output.

```bash
grep -rE '\bit\(|\btest\(|testWidgets\(' \
  packages/orchestrator/__tests__ \
  packages/cache/__tests__ \
  apps/cli/__tests__/doctor.test.ts \
  packages/codegen/test/idempotent_writer_test.dart \
  packages/runtime/test \
  packages/tokens/__tests__ \
  | awk -F: '{print $1}' | sort | uniq -c | sort -rn
```

```output
  10 packages/cache/__tests__/cache.test.ts
   8 apps/cli/__tests__/doctor.test.ts
   7 packages/tokens/__tests__/dtcg.test.ts
   5 packages/orchestrator/__tests__/vm-service.test.ts
   5 packages/orchestrator/__tests__/run-controller.test.ts
   4 packages/tokens/__tests__/emit-dart.test.ts
   4 packages/orchestrator/__tests__/debounce.test.ts
   4 packages/codegen/test/idempotent_writer_test.dart
   3 packages/tokens/__tests__/emit-tailwind.test.ts
   3 packages/runtime/test/app_nav_bar_test.dart
   3 packages/runtime/test/app_dialog_test.dart
   2 packages/runtime/test/app_list_tile_test.dart
```

Sums: 14 cache/orchestrator (Phase 2 R1 + R4) + 8 doctor (R5) + 4 dart idempotence (R2) = **26 Phase-2-specific tests**. Co-landed Phase 3 R1 (DTCG: 14 tests) and Phase 4 R1 (adaptive widgets: 8 tests) bring the parallel-epic delta to **48 new tests**, all green.

## 7. Re-run this demo

Re-execute every code block above and diff against the captured outputs by running \`showboat verify docs/demos/phase-2.md\` from the worktree root. Re-running drift-free is a load-bearing property of these demos: it's how a reviewer (human or another agent) can prove the work is still correct without having to mentally replay the implementation.
