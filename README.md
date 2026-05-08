# tsxtoflutter

Transform TSX + MDX emitted by Claude Design / Claude mockups skills into runnable Flutter apps. Inner loop target: ≤2 s per component, hot-reload preview.

## What this is

- TSX/MDX → JSON IR → Dart, never TSX → Dart directly.
- Deterministic codemods first (`@ast-grep/napi`); LLM fallback (Claude Sonnet 4.6 → Opus 4.7 escalation) for hooks-with-side-effects, naming, and ambiguous adaptive routing.
- Output is idiomatic Flutter: Material 3 + Riverpod 3 + adaptive shim layer (`AppButton`, `AppSwitch`, `AppScaffold`) — no `Platform.isIOS ? ... : ...` ternaries in user code.
- Hand-edit safe: every component emits a `foo.dart` (handwritten shell) + `foo.g.dart` (regenerated widget tree) pair via `part`/`part of`.

For the architecture rationale and per-domain deep dives, read `research/00-synthesis.md` and the six agent reports beside it. For the phased plan, see `docs/ROADMAP.md`.

## Layout

```
tsxtoflutter/
├── apps/
│   ├── cli/            # `tsxf` CLI: ingest, convert, watch, preview, eval, doctor
│   ├── preview/        # Vite 8 split-pane: live React | Flutter Web
│   └── docs/           # Storybook 9 component gallery
├── packages/
│   ├── ir/             # IR types + zod schema (the contract; shared by TS + Dart)
│   ├── ingest/         # TSX/MDX → IR (Babel + unified)
│   ├── tokens/         # DTCG → Tailwind config + Dart theme
│   ├── orchestrator/   # chokidar → ingest → codegen → Flutter VM hot-restart
│   ├── tsx-fixtures/   # canonical corpus the codegen must round-trip
│   ├── codegen/        # Dart CLI: IR JSON → Dart via code_builder + dart_style
│   └── runtime/        # Flutter package: Spacing, AppTokens, adaptive widgets
├── flutter_app/        # Generated Flutter app target
├── research/           # 6 agent reports + 00-synthesis.md
└── docs/ROADMAP.md     # phased plan
```

## Bring-up (first-time setup)

You need: Node 22+, pnpm 10+, Bun 1.2+, Flutter 3.27+ on the stable channel (with Dart 3.6+).

```pwsh
# 1. JS workspace
pnpm install

# 2. Generate Flutter platform folders (not committed; Flutter version pins them)
cd flutter_app
flutter create --platforms=web,ios,android --project-name=flutter_app .
flutter pub get
cd ..

# 3. Dart codegen + runtime
cd packages/codegen ; dart pub get ; cd ../..
cd packages/runtime ; flutter pub get ; cd ../..

# 4. Initialize git (project is not yet a repo)
git init
git add -A
git commit -m "initial scaffold"
```

## Dev loop

The save→see loop runs in three terminals.

```pwsh
# Terminal 1 — Flutter Web preview on port 8080
cd flutter_app
flutter run -d chrome --web-port=8080

# Terminal 2 — TS-side watcher (TSX/MDX → IR JSON)
pnpm --filter @tsxtoflutter/cli dev -- watch ./inputs

# Terminal 3 — Dart-side watcher (IR JSON → *.g.dart)
cd flutter_app
dart run tsxtoflutter:tsxtoflutter watch --ir .tsxtoflutter/ir --out lib/components
```

Optional, when you want the side-by-side view (live React on the left, Flutter Web iframe on the right):

```pwsh
pnpm --filter @tsxtoflutter/preview dev   # Vite on http://localhost:5173
```

## CLI reference

`tsxf` is the TS-side entry point. Run it via `pnpm --filter @tsxtoflutter/cli dev -- <subcommand>` during development, or after `pnpm build` via `pnpm --filter @tsxtoflutter/cli exec tsxf <subcommand>`.

| Command                         | What it does |
|---------------------------------|--------------|
| `tsxf init`                     | Scaffold the output Flutter project (one-time per project). |
| `tsxf convert <input...>`       | One-shot TSX/MDX → IR → Dart. |
| `tsxf convert <input> --no-llm` | Deterministic codemods only (CI sanity). |
| `tsxf watch [dir]`              | Start the orchestrator (chokidar + ingest + codegen subprocess + hot-restart). |
| `tsxf preview`                  | Spin up `flutter run -d chrome` against `flutter_app/`. |
| `tsxf cache stats \| clear \| gc` | Inspect or clear the parse / translate / build caches under `.tsxf-cache/`. |
| `tsxf eval --corpus golden/`    | Run the golden-corpus quality eval; non-zero exit on regression. |
| `tsxf doctor`                   | Verify Flutter, Dart, Bun, and `ANTHROPIC_API_KEY` are wired up. |
| `tsxf trace open <conversion-id>` | Open the OTel trace for a conversion in the Langfuse UI. |

The Dart side has its own CLI for codegen-only work (no TS dependency):

```pwsh
dart run tsxtoflutter:tsxtoflutter convert --ir <dir> --out <dir>
dart run tsxtoflutter:tsxtoflutter watch   --ir <dir> --out <dir>
```

## Build, test, typecheck

Driven by Turborepo from the root.

```pwsh
pnpm typecheck     # tsc --noEmit across all TS packages
pnpm test          # vitest across all TS packages
pnpm build         # tsc -b across all TS packages

# Dart side (per-package)
cd packages/codegen ; dart analyze ; dart test
cd ../runtime       ; flutter analyze ; flutter test
cd ../../flutter_app ; flutter analyze ; flutter test
```

CI runs the same gates plus a Flutter Web WASM build (`flutter build web --wasm`); see `.github/workflows/ci.yml`.

## Configuration

- `tsxtoflutter.config.ts` (project root, optional) — pin ruleset version, Claude model tier, per-conversion budgets. Defaults are fine for most use cases.
- `tokens.json` (DTCG v1, optional) — design tokens consumed by both Tailwind config emission and Dart `theme.dart` emission.
- `ANTHROPIC_API_KEY` env var — required only when the LLM fallback path is enabled.

## What this project deliberately does not do

- No Figma input. We ingest TSX from Claude Design, not designs from Figma.
- No runtime Tailwind interpreter. Classes resolve to numeric values at codegen time.
- No Server Components / Next.js routing translation. Mockups are presentational.
- No SEO/SSR conversion. TSX with `seo: true` frontmatter → hard error pointing at Next.js/Astro.
- No Liquid Glass native support (Flutter team won't ship it). `BackdropFilter` fakery only.
- No multi-tenant SaaS in v0 — local CLI + watch daemon only.

## Further reading

- `research/00-synthesis.md` — unified architecture, decisions, and resolved seams.
- `research/01-react-ingestion.md` … `06-backend-orchestration.md` — per-domain deep dives.
- `docs/ROADMAP.md` — phased delivery plan with milestones.
