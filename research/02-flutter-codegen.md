# Flutter-Side Architecture

**Author:** Flutter engineer agent (Opus) · **Date:** 2026-05-08
**Scope:** the Flutter/Dart codegen + runtime that consumes the React-side IR.

## 1. Target Flutter shape

### Primary state target: `ConsumerWidget` + `riverpod_generator` (Riverpod 3)

Pick **Riverpod 3 with code-generated providers** as the single primary target.

- Consensus default in 2026 for new Flutter apps. Generated code on a Riverpod foundation will look "right" to any Flutter reviewer.
- `@riverpod`-annotated providers map cleanly from React's "data flows down, callbacks flow up" model. `useState` → `@riverpod class Foo extends _$Foo`; `useMemo` → synchronous provider; `useEffect` async → `FutureProvider`/`StreamProvider`. This isomorphism is what lets the emitter produce hand-written-looking output.
- **Reject `flutter_hooks`** as primary. Hooks are imported from React and feel out of place in Flutter/Dart. Generated Dart should look like Flutter, not JSX with a Dart accent. Hooks can be a *secondary* opt-in for components that genuinely need local-only ephemeral state (animations); even then, prefer `AnimationController` in `ConsumerStatefulWidget`.
- BLoC: overkill for design components. Signals: still emerging.

**Widget shape rule:**
- Pure presentational → `StatelessWidget`.
- Local `useState` only → `ConsumerWidget` reading a colocated `NotifierProvider` via `part`.
- Effects/async/shared state → `ConsumerWidget` + dedicated provider file.

### Theming: Material 3 default, platform-adaptive escape hatches

Material 3 default. Tailwind/shadcn (which Claude Design emits) maps closer to M3 tonal palette than to Cupertino. For platform-adaptive widgets, generate calls into a small runtime helper (`adaptive_button.dart`, `adaptive_switch.dart`) that picks Cupertino on iOS/macOS and Material elsewhere. **Do not dual-emit Cupertino files.**

### Tailwind/CSS → Flutter widget mapping

| TSX/Tailwind | Flutter |
|---|---|
| `<div className="flex flex-row gap-4">` | `Row(spacing: 16, children: [...])` (Flutter 3.27+) |
| `<div className="flex flex-col gap-2">` | `Column(spacing: 8, children: [...])` |
| `<div className="grid grid-cols-3 gap-4">` | `GridView.count(crossAxisCount: 3, mainAxisSpacing: 16, crossAxisSpacing: 16, ...)` |
| `<div className="flex flex-wrap gap-2">` | `Wrap(spacing: 8, runSpacing: 8, ...)` |
| `p-4`, `px-2`, `py-3` | `Padding(padding: EdgeInsets.all(16))`, `EdgeInsets.symmetric(horizontal: 8)` |
| `mt-4`, `mb-2` | `SizedBox(height: 16)` between siblings (NOT `Padding`) |
| `max-w-md`, `w-full` | `ConstrainedBox(constraints: BoxConstraints(maxWidth: 448))`, `SizedBox(width: double.infinity)` |
| `absolute top-0 right-0` | `Stack` + `Positioned(top: 0, right: 0, child: ...)` |
| `rounded-lg`, `shadow-md`, `bg-card` | `DecoratedBox(decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), boxShadow: [...], color: context.tokens.surface))` |
| `text-lg font-semibold text-foreground` | `Text('...', style: context.tokens.textTheme.titleMedium.copyWith(fontWeight: FontWeight.w600))` |
| `hover:`, `focus:` | `MouseRegion` / `FocusableActionDetector` + `WidgetState.hovered`/`focused` |
| `space-y-4` | Same as `gap` on `Column` (built-in `spacing`) |
| `flex-1`, `grow` | `Expanded(child: ...)` or `Flexible` |

**Spacing scale** carried through. Tailwind's `4` (=1rem=16px) maps directly to logical pixels in Flutter — no rem conversion needed at the spacing level. Codify as `Spacing.s4 = 16.0` in runtime.

## 2. Codegen strategy

### Emit `.dart` directly from React-side IR via `code_builder` + `dart_style`

- `.arb` is for localized strings — category error.
- String templates get unreadable for nested widget trees and produce malformed Dart.
- [`code_builder`](https://pub.dev/packages/code_builder) is canonical Dart AST emitter (used by `freezed`, `json_serializable`). Auto-handles imports, gives strong-typed builders. Emit to `DartEmitter`, then `DartFormatter` from [`dart_style`](https://pub.dev/packages/dart_style).

```
TSX → (React side) → IR JSON → [Dart codegen package] → code_builder AST → DartEmitter → DartFormatter → .dart file
```

The codegen package is a pure-Dart CLI (`bin/tsxtoflutter.dart`) that watches an IR directory. **No `build_runner`/`source_gen`** — those are designed for "Dart-in, Dart-out" annotation-driven generation. JSON-from-non-Dart-toolchain → plain CLI watcher is simpler and avoids build_runner cold-start.

### Round-trip / hand-edit preservation: split files, don't merge

This is the single most important architectural call. **Do not** use sentinel comments / `// GENERATED:` regions inside a single file (every team that tried it has bled — FlutterFlow's "custom code" panes, older Xcode IB).

**Use the `part`/`part of` pattern, mirrored to two files per component:**

```
lib/components/card.dart          ← hand-written, never regenerated
lib/components/card.g.dart        ← regenerated every time, DO NOT EDIT
```

Hand-written `card.dart`:

```dart
part 'card.g.dart';

class Card extends ConsumerWidget {
  const Card({super.key, required this.title, this.body, this.onPressed});
  final String title;
  final String? body;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context, WidgetRef ref) => _$CardBuild(this, context, ref);
  // ^ developers can replace this body to customize. Regen never touches card.dart.
}
```

`card.g.dart` contains `Widget _$CardBuild(...) => ...` — the entire widget tree. Devs override behavior in `card.dart`; structure changes flow in via regen of `card.g.dart`.

**`.g.dart` is in `.gitignore` for "hot regen" mode and committed for "shipped" mode**, controlled by a project flag.

### Hot reload story

`flutter run` already has sub-second hot reload. Wire the loop:

1. TSX file saves → React side recomputes IR JSON → writes to `.tsxtoflutter/ir/*.json`
2. Dart codegen watcher (`package:watcher`) detects IR change → regenerates matching `*.g.dart` in <500ms
3. `flutter run`'s file watcher picks up the `.g.dart` change → hot reload (~400-800ms)

**Total inner loop: ~1-2 seconds.** Use `flutter run -d chrome` for the dev loop — Flutter Web is fastest to rebuild and easiest to embed in side-by-side preview.

## 3. Existing tooling research (2026)

- **FlutterFlow** with "Copilot" — generates apps but locked-in, proprietary scaffolding that doesn't read as hand-written Flutter. Visual-builder DNA shows in emitted Dart.
- **DhiWise** has the best raw Flutter code quality — "reusable, readable, well-structured" — but Figma-in, not TSX-in, and closed SaaS.
- **Locofy** outputs HTML-flavored boilerplate; "readable but not structured, not reusable."
- **Builder.io Visual Copilot** does Figma → Flutter with proper widget hierarchy; ~75% of the way there. Highest quality of SaaS options. Still Figma-input.
- **NTRN** — closest OSS prior art. JSX→Flutter with basic widget mapping. Output is shallow (HTML-element-by-element, not semantic).
- **DocuWriter.ai's JSX→Flutter** and **CodeConvert AI** are LLM API wrappers — fine for one-off snippets, not a build pipeline.
- **No existing tool occupies our exact niche** (TSX from a *known* source like Claude Design, semantic IR, hand-edit-friendly regen, Flutter-first). That's the gap.

**Flutter Web first.** Same Dart compiles unchanged to iOS/Android — *no* code-level fork between Web and native. Day-1: `-d chrome`. iOS/Android agents wire device targets without our codegen changing.

**Design-token bridges:** strongest 2026 option is [`design_tokens_builder`](https://github.com/simpleclub/design_tokens_builder) (Figma tokens → `ThemeData` via `build_runner`), backed by Material 3's `ThemeExtension`. [`token_theme_kit`](https://pub.dev/packages/token_theme_kit) is lighter alternative. Consume design tokens emitted by Claude Design as JSON, bake into a `ThemeExtension<AppTokens>` accessed via `context.tokens.*`.

**LLM/AI Flutter codegen:** Flutter's official [GenUI SDK](https://docs.flutter.dev/ai/genui) is 2026's big development — but solves a different problem (LLM-generated UI *at runtime* from a fixed widget catalog). The "widget catalog" concept is useful: define a *closed set* of widget primitives our codegen is allowed to emit, reject IR nodes that don't map. Bounds the surface area massively.

## 4. Concrete recommendations

### File layout

```
tsxtoflutter/
├─ packages/
│  ├─ tsxtoflutter_codegen/              ← pure-Dart CLI: IR JSON → Dart
│  │  ├─ bin/tsxtoflutter.dart           ← `dart run tsxtoflutter watch ./ir`
│  │  ├─ lib/src/emitter/                ← code_builder helpers per IR node type
│  │  ├─ lib/src/mapping/tailwind.dart   ← the table from §1, programmatic
│  │  ├─ lib/src/mapping/widgets.dart    ← IR primitive → widget builder
│  │  └─ lib/src/format.dart             ← DartFormatter wrapper
│  └─ tsxtoflutter_runtime/              ← Flutter package shipped to apps
│     ├─ lib/src/spacing.dart            ← Spacing.s1..s64 = Tailwind scale
│     ├─ lib/src/tokens.dart             ← AppTokens ThemeExtension
│     ├─ lib/src/breakpoints.dart        ← sm/md/lg/xl helpers
│     ├─ lib/src/adaptive/               ← adaptive_button.dart etc.
│     └─ lib/tsxtoflutter_runtime.dart   ← barrel
└─ example_app/                          ← generated Flutter app target
   ├─ pubspec.yaml
   ├─ lib/
   │  ├─ main.dart                       ← hand-written shell
   │  ├─ app.dart                        ← hand-written, picks up generated routes
   │  ├─ tokens.g.dart                   ← regenerated from design tokens
   │  └─ components/
   │     ├─ card.dart                    ← hand-written, edit-safe
   │     └─ card.g.dart                  ← regenerated
   └─ .tsxtoflutter/ir/                  ← IR JSON dropped by React side
```

Two packages so codegen is testable in pure-Dart-VM (fast unit tests) and runtime is the only thing apps depend on.

### `pubspec.yaml` for `example_app`

```yaml
name: example_app
environment:
  sdk: ^3.6.0
  flutter: ^3.27.0

dependencies:
  flutter:
    sdk: flutter
  flutter_riverpod: ^3.0.0
  riverpod_annotation: ^3.0.0
  go_router: ^14.0.0
  google_fonts: ^6.2.0
  tsxtoflutter_runtime:
    path: ../packages/tsxtoflutter_runtime

dev_dependencies:
  flutter_test:
    sdk: flutter
  build_runner: ^2.4.0
  riverpod_generator: ^3.0.0
  custom_lint: ^0.6.0
  riverpod_lint: ^3.0.0
  flutter_lints: ^5.0.0
```

### Example: "Card with title, body, primary button"

Input TSX:
```tsx
<Card>
  <h3 className="text-lg font-semibold">Welcome back</h3>
  <p className="text-muted-foreground">Sign in to continue.</p>
  <Button variant="primary" onClick={handleSignIn}>Sign in</Button>
</Card>
```

Emitted **`welcome_card.dart`** (hand-edit safe):
```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tsxtoflutter_runtime/tsxtoflutter_runtime.dart';

part 'welcome_card.g.dart';

class WelcomeCard extends ConsumerWidget {
  const WelcomeCard({super.key, required this.onSignIn});
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      _$WelcomeCardBuild(this, context, ref);
}
```

Emitted **`welcome_card.g.dart`** (regenerated):
```dart
// GENERATED CODE - DO NOT MODIFY BY HAND
part of 'welcome_card.dart';

Widget _$WelcomeCardBuild(WelcomeCard w, BuildContext context, WidgetRef ref) {
  final tokens = context.tokens;
  return Card(
    elevation: 0,
    color: tokens.surface,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Spacing.s2)),
    child: Padding(
      padding: const EdgeInsets.all(Spacing.s6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: Spacing.s2,
        children: [
          Text('Welcome back', style: tokens.text.titleMedium),
          Text('Sign in to continue.',
              style: tokens.text.bodyMedium.copyWith(color: tokens.mutedForeground)),
          const SizedBox(height: Spacing.s2),
          FilledButton(onPressed: w.onSignIn, child: const Text('Sign in')),
        ],
      ),
    ),
  );
}
```

What makes this look hand-written:
- `Spacing.s6` not `EdgeInsets.all(24)` magic numbers.
- `tokens.text.titleMedium` not raw `TextStyle`.
- Built-in `Column.spacing` (Flutter 3.27+) instead of interleaving `SizedBox`es.
- `FilledButton` (M3 idiom for primary) — *not* `ElevatedButton` (legacy).
- No anonymous closures, no Builder soup.

### Runtime support library — minimum viable

```dart
// spacing.dart — Tailwind's scale, in logical pixels
abstract final class Spacing {
  static const double s0 = 0, s1 = 4, s2 = 8, s3 = 12, s4 = 16,
                     s5 = 20, s6 = 24, s8 = 32, s10 = 40, s12 = 48, s16 = 64;
}

// breakpoints.dart — Tailwind sm/md/lg/xl
abstract final class Breakpoints {
  static const double sm = 640, md = 768, lg = 1024, xl = 1280;
}
extension ResponsiveX on BuildContext {
  bool get isMd => MediaQuery.sizeOf(this).width >= Breakpoints.md;
}

// tokens.dart — ThemeExtension carrying design tokens
class AppTokens extends ThemeExtension<AppTokens> {
  final Color surface, mutedForeground, primary, /* ... */;
  final AppTextTokens text;
}
extension TokensX on BuildContext {
  AppTokens get tokens => Theme.of(this).extension<AppTokens>()!;
}
```

Keep this library *small*. Every helper added is a thing the codegen has to know about.

## Key open questions for the React side

1. **IR shape**: Will you ship a typed JSON IR with JSON Schema?
2. **Tailwind token resolution**: Will the IR contain *resolved* style values (`{padding: 16}`) or raw class strings (`"p-4"`)? Resolved is better.
3. **Component identity & stability**: How is a component named across regens? File path + export name? Stable ID?
4. **Event handlers**: How are `onClick={handleSignIn}` references represented? Suggest: every handler becomes a named prop on the widget, body becomes a TODO comment.
5. **Conditional rendering & lists**: `{cond && <X/>}`, `arr.map(...)`. Pre-lower to typed `If`/`Map` nodes, or leave as raw JS expressions?
6. **Design tokens source**: Separate `tokens.json` (preferred) or inline on components?
7. **MDX content**: Pre-render to semantic blocks, or runtime Markdown engine?
8. **Component library boundary**: Which shadcn subset? Need a 1:1 mapping table (`<Button variant="primary">` → `FilledButton`, `<Card>` → `Card`).

## Mobile/platform questions for the iOS/Android agents

1. **Adaptive widgets — how far?** Default to Material 3 with `adaptive_*` helpers. Full Cupertino on iOS chrome (nav bars, scroll physics) or only input controls?
2. **Safe area**: We plan to wrap scaffold bodies in `SafeArea` automatically. Confirm.
3. **Navigation**: We're emitting `go_router`. iOS expects `CupertinoPageRoute`-style transitions; should codegen pick automatically?
4. **Gestures**: Should we emit `HapticFeedback.lightImpact()` on tap by default?
5. **Splash & launcher icons**: `flutter_launcher_icons` / `flutter_native_splash` — out of codegen scope.
6. **Asset pipelines**: Bundle into Flutter assets via `pubspec.yaml`, or CDN at runtime?
7. **Permissions / native plugins**: Camera/contacts/geolocation — emit `// TODO: requires native permission`.
8. **Min SDK**: iOS 14 / Android API 24 / Flutter 3.27 reasonable defaults.

## Sources
- [code_builder](https://pub.dev/packages/code_builder)
- [dart_style](https://pub.dev/packages/dart_style)
- [Code Generation with Dart & Flutter — Code With Andrea](https://codewithandrea.com/articles/dart-flutter-code-generation/)
- [Flutter hot reload](https://docs.flutter.dev/tools/hot-reload)
- [Best Flutter State Management 2026 — Foresight Mobile](https://foresightmobile.com/blog/best-flutter-state-management)
- [Flutter State Management 2026 — SoftAims](https://softaims.com/blog/flutter-state-management-riverpod-bloc-2026)
- [Riverpod about hooks](https://riverpod.dev/docs/concepts/about_hooks)
- [GenUI SDK for Flutter](https://docs.flutter.dev/ai/genui)
- [State of Flutter 2026 — devnewsletter](https://devnewsletter.com/p/state-of-flutter-2026/)
- [Builder.io Figma-to-Flutter](https://www.builder.io/blog/figma-to-flutter)
- [Best Figma-to-code Plugin — Builder.io](https://www.builder.io/blog/best-figma-to-code-plugin)
- [AI Figma-to-Code 2026 — sixtythirtyten](https://www.sixtythirtyten.co/blog/from-figma-to-code-ai-design-to-dev-workflows-in-2026)
- [DhiWise vs Locofy](https://www.dhiwise.com/post/dhiwise-vs-locofy)
- [NTRN](https://github.com/AmeyKuradeAK/ntrn)
- [JSX to Flutter Converter — DocuWriter.ai](https://www.docuwriter.ai/jsx-to-flutter-code-converter)
- [design_tokens_builder](https://github.com/simpleclub/design_tokens_builder)
- [token_theme_kit](https://pub.dev/packages/token_theme_kit)
- [Flutter for React Native developers](https://docs.flutter.dev/get-started/flutter-for/react-native-devs)
- [Material Design for Flutter](https://docs.flutter.dev/ui/design/material)
