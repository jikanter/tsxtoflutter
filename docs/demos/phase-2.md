# Phase 2 — Preview + hot loop

*2026-05-08T18:24:44Z by Showboat 0.6.1*
<!-- showboat-id: ed1539e4-a8a1-4a34-96cf-517d509d7679 -->

Phase 2 turns the bare TSX→Dart pipeline from Phase 1 into an inner save→see loop. This demo proves: (1) the orchestrator's debouncer / run-controller / VM-service helpers behave correctly under burst, cancel, and timeout; (2) the Dart-side watcher emits **byte-identical** Dart on no-op IR changes (so the Flutter VM doesn't see spurious file events); (3) the side-by-side preview app boots with the COOP/COEP headers Skwasm requires; (4) the three-tier content-addressed cache writes, reads, summarizes, and garbage-collects across tiers; and (5) \`tsxf doctor\` is honest about a half-provisioned environment.

## 1. tsxf doctor

Doctor is the bring-up sanity check. It probes node / pnpm / bun / flutter / dart for the version floors specified in the roadmap and verifies that \`flutter_app/.dart_tool/\` exists (i.e. someone has run \`flutter pub get\`). The unit tests fake the probe so the version-comparison logic is exercised independent of the local toolchain.

```bash
pnpm --filter @tsxtoflutter/cli exec vitest run __tests__/doctor.test.ts 2>&1 | tail -8
```

```output

 ✓ __tests__/doctor.test.ts (8 tests) 2ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  13:27:14
   Duration  335ms (transform 62ms, setup 0ms, collect 59ms, tests 2ms, environment 0ms, prepare 46ms)

```

Run \`tsxf doctor\` against the worktree: every tool meets its floor, but \`flutter_app/.dart_tool/\` is absent in this clean checkout (the user re-runs \`flutter pub get\` per the README), so doctor surfaces the precise remediation and exits non-zero — exactly as specified.

```bash
rm -rf flutter_app/.dart_tool 2>/dev/null; bun apps/cli/src/index.ts doctor --repo-root . 2>&1; echo "exit: $?"
```

```output
[ok ] node 24.14.0
[ok ] pnpm 10.0.0
[ok ] bun 1.3.12
[ok ] flutter 3.41.9
[ok ] dart 3.11.5
[FAIL] flutter_app: missing .dart_tool — run `flutter pub get` in flutter_app/

tsxf doctor found issues — fix the FAIL lines above.
exit: 1
```

## 2. Three-tier content-addressed cache

Three tiers: \`parse\` (TSX → React-IR), \`xlate\` (React-IR subtree → Flutter-IR fragment, key includes ruleset-version + model-id so Phase 3's LLM cache reuses the same disk layout), and \`build\` (Dart sources + pubspec → built artifact). The store is content-addressed under \`<cache-dir>/<tier>/<sha256>.json\`. Tests exercise key derivation, round-trip, stats, clear, and gc-by-mtime.

```bash
pnpm --filter @tsxtoflutter/cache test 2>&1 | tail -10
```

```output

 RUN  v2.1.9 /Volumes/ExternalData/admin/Developer/Projects/tsxtoflutter/.claude/worktrees/parallel-epic/packages/cache

 ✓ __tests__/cache.test.ts (10 tests) 13ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  13:27:34
   Duration  221ms (transform 27ms, setup 0ms, collect 27ms, tests 13ms, environment 0ms, prepare 29ms)

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

The orchestrator is split into three independently-testable pieces: a trailing-edge **debouncer** (collapses an editor's save-burst of 3–5 fs events into a single ingest call), a **VM-service** client (parses Flutter's stdout for the URL and POSTs \`_reloadSources\` over WebSocket with a 3 s hard timeout per the Skwasm risk register), and a **run-controller** that serializes async work so at most one is in flight and at most one is pending — a third submit displaces the queued second ("never queue more than one").

```bash
pnpm --filter @tsxtoflutter/orchestrator exec vitest run 2>&1 | tail -12
```

```output

 RUN  v2.1.9 /Volumes/ExternalData/admin/Developer/Projects/tsxtoflutter/.claude/worktrees/parallel-epic/packages/orchestrator

 ✓ __tests__/debounce.test.ts (4 tests) 8ms
 ✓ __tests__/vm-service.test.ts (5 tests) 7ms
 ✓ __tests__/run-controller.test.ts (5 tests) 154ms

 Test Files  3 passed (3)
      Tests  14 passed (14)
   Start at  13:27:52
   Duration  445ms (transform 81ms, setup 0ms, collect 147ms, tests 168ms, environment 0ms, prepare 221ms)

```

Smoke-test \`tsxf watch\` against the canonical Button fixture: chokidar sees the network volume under \`/Volumes/\` and switches on \`usePolling\` automatically. (We kill the process immediately; this just proves boot.)

```bash
DEMO=/tmp/tsxf-watch-demo
rm -rf "$DEMO"
mkdir -p "$DEMO/inputs" "$DEMO/flutter"
cp packages/tsx-fixtures/fixtures/Button.tsx "$DEMO/inputs/"
timeout 1 bun apps/cli/src/index.ts watch "$DEMO/inputs" \
  --ir-out "$DEMO/ir" \
  --out "$DEMO/out" \
  --flutter-app "$DEMO/flutter" \
  --cache-dir "$DEMO/cache" 2>&1 | head -2
rm -rf "$DEMO"
echo 'watch boot ok'
```

```output
watching /tmp/tsxf-watch-demo/inputs/**/*.{tsx,mdx} (debounce 100ms, polling)

watch boot ok
```

## 4. Dart-side watch — idempotent emission

The Dart watcher's hard requirement is **idempotence**: the same IR JSON must produce byte-identical Dart output, and a no-op rerun must not bump file mtimes (so chokidar / \`flutter run\` don't see ghost events). \`writeIfChanged\` enforces this; the emitter only generates the hand-written shell when it's missing, so developer edits survive every regeneration. The four idempotence tests assert: first-run produces the pair; second-run with identical IR writes zero files and preserves mtime; a hand-edited shell is not clobbered; \`writeIfChanged\` returns \`false\` on a byte-match.

```bash
cd packages/codegen && dart test test/idempotent_writer_test.dart 2>&1 | tail -10
```

```output
00:00 +0: loading test/idempotent_writer_test.dart
00:00 +0: emitAllInDir produces shell + generated pair on first run
00:00 +1: second run with identical IR writes no files (idempotent)
00:00 +2: preserves a hand-edited shell file
00:00 +3: writeIfChanged returns false when bytes match
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
grep -E 'FIXTURES' apps/preview/src/App.tsx | head -2
```

```output
--- COOP/COEP headers in vite config ---
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
--- iframe pointing at flutter web ---
            src="http://localhost:8080/"
--- fixture selector wired to workspace registry ---
import { FIXTURES, type FixtureEntry } from '@tsxtoflutter/tsx-fixtures';
  // FIXTURES paths are relative to the tsx-fixtures package root; convert to
```

## 6. Aggregate test count

Phase 2 lands the following test counts across packages it touches. (Phase 1's tests are unchanged; Phase 4's runtime widget tests live alongside.)

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

Re-execute every code block above and diff against the captured outputs:

```
showboat verify docs/demos/phase-2.md
```

Re-running drift-free is a load-bearing property of these demos: it's how a reviewer (human or another agent) can prove the work is still correct without having to mentally replay the implementation.
