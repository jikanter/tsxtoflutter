# Web/Tooling/Preview Architecture

**Author:** Web engineer agent (Opus) · **Date:** 2026-05-08
**Scope:** owning the web side of a TSX→Flutter codegen pipeline. Flutter Web ships first; iOS/Android follow.

## 1. Monorepo & dev loop

**Pick: pnpm workspaces + Turborepo, Bun reserved for scripts.** pnpm's workspace protocol is the de-facto standard in 2026 with first-class Turborepo/Nx support. Turborepo gives caching + task graphs without forcing the Nx project-graph mental model — appropriate for a 5–15 package repo. Nx only wins past ~50 packages or when you need affected-graph CI sharding. Bun is 4–5× faster on cold install but workspace edge cases still bite — use Bun as a script runtime (`bun run`, `bun test` for codegen package) but keep installs on pnpm.

**Top-level layout:**

```
tsxtoflutter/
  apps/
    preview/              # Vite app: side-by-side TSX | Flutter Web preview
    docs/                 # Storybook 9 (component gallery for inputs)
  packages/
    codegen/              # TSX+MDX → Dart AST → Dart source (TS, Bun-runnable)
    tailwind-resolver/    # resolves Tailwind class strings → design tokens
    tsx-fixtures/         # canonical input components (test corpus)
    flutter-runtime/      # Dart support lib (shared widgets codegen emits)
  flutter_app/            # the generated Flutter app target (pubspec.yaml here)
  tools/
    orchestrator/         # file watcher + chokidar → codegen → flutter build
  turbo.json
  pnpm-workspace.yaml
```

Pin: **Vite 8** (Rolldown-based, 10–30× build speedups), **Tailwind 4.x** with `@tailwindcss/vite`, **pnpm 10**, **Bun 1.2+**, **Flutter 3.32+** (80%-faster semantics tree).

## 2. Live side-by-side preview

**Don't use Storybook to host both sides.** No first-party Storybook⇄Flutter bridge in 2026; community equivalents (`storybook_flutter`, Widgetbook) are entirely separate Dart apps.

**Architecture: a Vite app that owns both panes.**

- Left pane: live React render of `.tsx` (Vite HMR, native).
- Right pane: an `<iframe>` (or Flutter element-embedding via `hostElement`) pointing at Flutter Web dev server (`flutter run -d chrome --web-port=…`).
- A small **orchestrator** (Node/Bun, chokidar) watches `apps/preview/src/**/*.tsx`, runs codegen → writes to `flutter_app/lib/generated/`, pings Flutter's hot-restart over its VM service. Flutter Web has hot **restart** (not hot reload for stateful) but fast enough for save-driven loop.

**Dev loop on save (target ≤ 2 s):**

1. t=0 ms — developer saves `Foo.tsx`.
2. t≈30 ms — Vite HMR updates left pane.
3. t≈80 ms — chokidar fires; codegen reads MDX frontmatter + TSX AST, runs Tailwind resolver, emits `foo.dart`.
4. t≈300 ms — orchestrator POSTs to Flutter's VM-service → hot restart.
5. t≈1.0–1.5 s — right pane repaints. Diff overlay recomputes.

## 3. Diff view

**Two diffs, two tools.**

- **Pixel diff:** Playwright's built-in `toHaveScreenshot()` against both panes, headed in dev mode, with `pixelmatch` under the hood (~50 ms for 1280×720). Cheap, deterministic, no SaaS.
- **Semantic/tree diff:** scrape React's rendered DOM (left) and Flutter's **semantics tree** (right, via `?enable-semantics=true` and the auto-generated ARIA DOM) — diff role/label/text. Catches "looks right, screen-reader broken" regressions.
- **Skip Chromatic/Percy for now.** Cloud-priced, Storybook-coupled, overkill while codegen is unstable. Revisit when fixtures stabilize.

## 4. Flutter Web specifics

**Renderer default: WASM (Skwasm) with CanvasKit JS fallback** — that's now Flutter's own out-of-the-box behavior when you `flutter build web --wasm`. The HTML renderer is removed in 2025 stable; do not target it.

Tradeoffs:
- **Skwasm:** ~1.1 MB renderer, 2–3× CanvasKit graphics perf, near-native frame times. **Requires COOP/COEP headers** at the host.
- **CanvasKit:** 1.5–2 MB, JS fallback for browsers without WasmGC (pre-Chrome 119/Safari 17).
- **Text selection / SEO / a11y:** all routed through Flutter semantics tree → ARIA DOM regardless of renderer.

**Accessibility honest take:** Flutter 3.32's semantics overhaul (≈80% faster build, 30% frame-time reduction with semantics on, fixed tab focus traps) finally makes Flutter Web a11y *acceptable* for app-shell content. **Still not equivalent** to hand-written semantic HTML. For app-shell UIs (dashboards, tools): ship Flutter Web only. For marketing/landing pages: see §5.

**Hosting: Cloudflare Pages.** Static output, unlimited bandwidth on free tier, 300+ edge locations, and — critically — Cloudflare lets us set COOP/COEP headers via `_headers` cleanly for Skwasm. Vercel is fine for DX but free tier prohibits commercial use and edge count is much smaller.

**Bundle-size budget:** target ≤ 3.5 MB transferred for first paint of typical screen (Skwasm ~1.1 MB + framework ~1 MB + app code ≤ 1 MB + fonts deferred). Anything past 5 MB and we should refuse to convert without a code-splitting story.

## 5. Web-specific concerns

**SEO/SSR policy — refuse-and-route.** Flutter Web has no native SSR in 2026 ([flutter#47600](https://github.com/flutter/flutter/issues/47600) still open) and prerender hacks are fragile. **Policy:** any TSX component whose MDX frontmatter has `seo: true` or `route.public: true` (landing/marketing/blog) is **not converted**; codegen emits hard error pointing author at Next.js/Astro export path instead. Don't pretend Flutter Web is SEO-equivalent.

**Browser-only APIs.** Maintain `web-shim` table in `packages/codegen`:

| TSX surface | Flutter equivalent |
|---|---|
| `navigator.clipboard` | `Clipboard` (services) |
| `<input type=file>` | `file_picker` package |
| HTML5 DnD | `Draggable` / `DragTarget` |
| `IntersectionObserver` | `VisibilityDetector` |
| `window.history` push | `go_router` |
| `localStorage` | `shared_preferences` |
| `WebSocket` | `web_socket_channel` |
| `fetch` | `package:http` / `dio` |

Any TSX usage *not* in table → codegen emits `// TODO(tsxtoflutter): unsupported web API: …` and a build-time warning, not silent fail.

**Tailwind → Flutter — resolve at codegen time, do NOT parse class strings at runtime.** Run `tailwindcss --content … -o tokens.css` against source TSX at codegen time, then read **resolved Tailwind theme** (via `resolveConfig` and v4 `compile()` programmatic API) to get actual numeric values. Map to Flutter (`px-4` → `EdgeInsets.symmetric(horizontal: 16)`). Runtime "Tailwind-in-Flutter" packages (`tailwind_cli`, `wind`, `flutterwind`) re-implement an interpreter we don't need and don't see arbitrary values like `top-[17px]`. Codegen-time resolution gives static, dead-code-eliminable Dart.

## 6. Existing tooling — 2026

- **No mature TSX→Flutter transpiler exists.** Closest are `flutterjsx` (toy), `react-native-to-flutter` (RN-only, GeekyAnts), AI-converter SaaS. We are building greenfield.
- **Component-doc tool: Storybook 9** for TSX side, despite Ladle's 6.7× faster cold start. Storybook's a11y/Chromatic/MSW ecosystem matters more than 7 s of cold start for a project that lives or dies on UI verification. Ladle is a fine fallback if Storybook regresses.
- **Flutter side documentation: Widgetbook** (Storybook-shaped, Flutter-native, 2k+ teams). Wire as sibling to Storybook so each codegen output gets a Widgetbook story too.

## 7. Concrete picks (versions, May 2026)

- Vite 8 · Tailwind 4.x · pnpm 10 · Bun 1.2+ · Turborepo · TypeScript 5.7+
- Flutter 3.32+ stable, `flutter build web --wasm` (Skwasm) · `dart format` post-emit
- Storybook 9 (TSX gallery) · Widgetbook (Flutter gallery) · Playwright (pixel/semantics diff)
- Cloudflare Pages (Flutter Web preview hosting, with COOP/COEP `_headers`)
- chokidar + Bun script as orchestrator

## Open questions for the React/Flutter agents

1. **React agent — TSX subset:** policy on hooks-with-side-effects (`useEffect` for fetch, subscriptions)? Codegen needs finite hook contract.
2. **React agent — MDX role:** is MDX just metadata (frontmatter) or do we render MDX prose inside components?
3. **Flutter agent — state model:** Riverpod, Bloc, or plain `ValueNotifier`?
4. **Flutter agent — design system:** Material 3, Cupertino, or custom theme generated from Tailwind tokens?
5. **Flutter agent — routing:** `go_router` only, or shell routes / deep-link parity with React app?
6. **Both — fixture corpus:** which 20 TSX components are canonical "must round-trip pixel-perfect" set? Need them in `packages/tsx-fixtures` before any of this matters.
7. **Both — async/data:** does TSX input ever fetch, or are inputs always pure presentational?

## Sources

- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)
- [Tailwind v4](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind 4 programmatic API](https://github.com/tailwindlabs/tailwindcss/discussions/16581)
- [Turborepo vs Nx 2026 — PkgPulse](https://www.pkgpulse.com/guides/turborepo-vs-nx-monorepo-2026)
- [pnpm vs Bun 2026 — PkgPulse](https://www.pkgpulse.com/guides/pnpm-vs-bun-2026)
- [Storybook vs Ladle vs Histoire 2026 — PkgPulse](https://www.pkgpulse.com/guides/storybook-8-vs-ladle-vs-histoire-2026)
- [Flutter Web renderers](https://docs.flutter.dev/platform-integration/web/renderers)
- [Flutter HTML renderer deprecation](https://groups.google.com/g/flutter-announce/c/JqkMe7cPkQo)
- [Flutter Web & WASM 2026 guide](https://amgres.com/blog/flutter-web-webassembly-wasm-2026-guide)
- [Flutter Web accessibility](https://docs.flutter.dev/ui/accessibility/web-accessibility)
- [Mastering Accessibility in Flutter — Somnio](https://somniosoftware.com/blog/mastering-accessibility-in-flutter-a-deep-dive-into-semantics)
- [Embedding Flutter Web](https://docs.flutter.dev/platform-integration/web/embedding-flutter-web)
- [p-mazhnik/flutter-embedding](https://github.com/p-mazhnik/flutter-embedding)
- [Flutter SSR issue #47600](https://github.com/flutter/flutter/issues/47600)
- [Flutter Web SEO 2025 — Flexxited](https://flexxited.com/blog/flutter-web-seo-how-to-fix-single-page-app-ranking-issues-2025-guide)
- [Cloudflare Pages vs Vercel 2026](https://contracollective.com/blog/vercel-vs-cloudflare-pages-edge-deployment-2026)
- [Deploy Flutter Web to Cloudflare Pages](https://dev.to/hrishiksh/deploy-flutter-web-app-to-cloudflare-pages-jcl)
- [Playwright Visual Testing — Testdino](https://testdino.com/blog/playwright-visual-testing)
- [storybook_flutter](https://pub.dev/packages/storybook_flutter)
- [Widgetbook](https://www.widgetbook.io/storybook-for-flutter)
- [flutterjsx](https://github.com/danialdezfouli/flutterjsx)
- [tailwind_cli (Flutter)](https://pub.dev/packages/tailwind_cli)
- [fluttersdk/wind](https://github.com/fluttersdk/wind)
