# Android Concerns for the TSX → Flutter Codegen Pipeline

**Author:** Android engineer agent (Opus) · **Date:** 2026-05-08

The Flutter agent's recommendation to target Dart is correct, but Android in 2026 has a sharper set of constraints than most TSX-to-X tooling was designed for. Below are the things our codegen MUST get right, the tooling competition, and a concrete checklist.

## 1. Android-specific concerns the generated Dart MUST handle

### 1.1 Material 3 / Material You dynamic color
Tailwind/React tokens from Claude Design are **static** (`bg-blue-500`, `text-slate-900`). On Android 12+, users expect Material You.

- Wrap `MaterialApp` in `DynamicColorBuilder` from [`dynamic_color`](https://pub.dev/packages/dynamic_color).
- Codegen should emit a **two-track theme**: a "brand" `ColorScheme.fromSeed(seedColor: <token>)` as fallback, and a `dynamic` track that prefers `lightDynamic`/`darkDynamic` when platform provides them.
- **Map Tailwind tokens to Material 3 *roles*** (`primary`, `onPrimary`, `surfaceContainerHigh`, `outlineVariant`) rather than raw hex. New M3 roles (`surfaceContainer*`, `surfaceTint`) must be filled or M3 widgets look wrong.
- Day-1 default: `useMaterial3: true`, `ThemeMode.system`.

### 1.2 Edge-to-edge, system bars, safe areas
Highest-risk area. **Android 16 makes edge-to-edge mandatory with no opt-out**; `SystemUiOverlayStyle.statusBarColor` and `systemNavigationBarColor` are no-ops on API 36+.

- Never emit naive `Padding(EdgeInsets.only(top: 24))` for status bar offset. Always `SafeArea` (or `MediaQuery.paddingOf(context)`).
- For text fields and bottom-anchored content, use `MediaQuery.viewInsetsOf(context)` (IME) plus `viewPaddingOf` (gesture nav). Generated `Scaffold` should set `resizeToAvoidBottomInset: true` by default.
- Bottom navigation/sheets MUST consume `viewPadding.bottom`.
- Emit `values-v35/styles.xml` with NO `windowOptOutEdgeToEdgeEnforcement` (Play Console flags this since late 2025).

### 1.3 Predictive back gesture (Android 14+, default in 15+)
Predictive back is default on Android 15+. Generated app must use **`PopScope`** (not `WillPopScope`/`Navigator.willPop`). Default page transition is `PredictiveBackPageTransitionsBuilder`.

When TSX uses any "confirm before close" pattern (`window.confirm`, custom modals on `beforeunload`), codegen must translate to `PopScope(canPop: false, onPopInvokedWithResult: ...)`. Failing this silently breaks user expectations on every Android 15+ device.

Add `android:enableOnBackInvokedCallback="true"` in generated `AndroidManifest.xml`.

### 1.4 Foldables / large screens
~270M active large-screen Android devices. Play Store quality reviews now penalize phone-only layouts.

- Codegen must NOT lock orientation in `main()`.
- Above 600dp width, switch list/detail patterns to two-pane via `LayoutBuilder` or `NavigationRail` instead of `BottomNavigationBar`. **Infer breakpoints from CSS media queries / Tailwind `md:`/`lg:` variants** and emit a `LayoutBuilder` switch.
- Avoid hard-coded pixel widths on top-level columns; convert Tailwind `max-w-*` to `ConstrainedBox(maxWidth:)` rather than `SizedBox(width:)`.

### 1.5 IME / keyboard
- `Scaffold.resizeToAvoidBottomInset: true` is default but breaks if TSX emits a custom `Stack` root. Forms MUST wrap in `SingleChildScrollView` + `Padding(EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom))`.
- Password fields: `obscureText: true`, `enableSuggestions: false`, `autocorrect: false`, `autofillHints: [AutofillHints.password]`. Map from `<input type="password">` and `autoComplete="current-password"`.

### 1.6 Accessibility — TSX `aria-*` → Flutter `Semantics`

| TSX                                | Dart                                                  |
|------------------------------------|-------------------------------------------------------|
| `aria-label="..."`                 | `Semantics(label: "...")`                             |
| `aria-hidden="true"`               | `ExcludeSemantics()`                                  |
| `role="button"` + `onClick`        | `Semantics(button: true, onTap: ...)` or `InkWell`    |
| `role="link"`                      | `Semantics(link: true)` (TalkBack reads "link")       |
| `role="heading"` + `aria-level="2"`| `Semantics(header: true, headingLevel: 2)`            |
| `aria-live="polite"`               | `Semantics(liveRegion: true)`                         |
| `aria-disabled`                    | `Semantics(enabled: false)`                           |
| `alt="..."` on `<img>`             | `Semantics(label:, image: true)`                      |

Decorative SVGs without `alt` → wrap in `ExcludeSemantics`. Touch targets ≥48dp (`MaterialTapTargetSize.padded` is default).

## 2. Build, signing, distribution

**Gradle / AGP defaults:**
- `compileSdk = 36`, `targetSdk = 36`, `minSdk = 24`.
- `ndk.version` pinned, **16KB page-size aligned `.so`** — Play Store rejects non-aligned native libs since Nov 2025.
- `isMinifyEnabled = true`, `isShrinkResources = true` for release.

**R8 / ProGuard:** Generate `proguard-rules.pro` template with keep rules for Flutter framework, every plugin emitted, and the project's serializable models. Wire `flutter build appbundle --release --obfuscate --split-debug-info=build/symbols`; upload symbols to Crashlytics/Sentry.

**AAB only**, never APK for Play. Validate locally with `bundletool build-apks --connected-device`.

**Signing:** Generate `key.properties` template + `.gitignore` entry. `signingConfig` from env vars so CI can inject. Never bake into Gradle.

**Fastlane / metadata:** **Yes** — pipeline should emit `fastlane/metadata/android/en-US/{title,short_description,full_description,changelogs/}` from same TSX/MDX content. Screenshots: codegen drives `flutter_screenshot`/golden runs across `phoneScreenshots/`, `sevenInchScreenshots/`, `tenInchScreenshots/`.

**CI:** GitHub Actions `ubuntu-latest` now has KVM, so Android emulator matrix is viable and faster than macOS runners. Minimum gate: `flutter analyze` → unit/widget tests → `flutter build appbundle --debug` → `reactivecircus/android-emulator-runner@v2` boots API 34 + API 36 emulators and runs `flutter test integration_test/launch_test.dart`. Pass = generated app launched and rendered first frame.

## 3. Existing tooling — 2026 state

- **FlutterFlow Android export**: Real Dart that compiles, but boilerplate-heavy state code; needs >$39/mo to export, output routinely needs cleanup. **Lesson: ship clean exportable Dart from day 1**, no proprietary runtime layer.
- **Builder.io Visual Copilot 2.0**: Figma-to-Flutter (and Compose, RN) with "BYO components"; pixel-fidelity is good, but state and platform glue (back gesture, IME, dynamic color) are basically absent — output is a *screen*, not an *app*. **That's our wedge: we own the platform layer.**
- **TSX → Compose**: Nothing official. Tiger Oakes' [React to Compose dictionary](https://tigeroakes.com/posts/react-to-compose-dictionary/) is the closest mapping reference, useful for our IR design. React Native's `Codegen` (TS → JNI/ObjC scaffolding) is the only mature TS-to-mobile codegen.
- **RN ↔ Compose interop (Fabric/JSI)**: RN 0.85 (April 2026) finalized new architecture; sync JSI calls drop interop latency from ~200ms to <2ms. **Lesson: synchronous, typed, columnar IR > stringly-typed bridge.**
- **Flutter vs Compose in 2026**: With Impeller default on Android API 29+ since 3.27, shader-comp jank largely solved (~30–50% jank-frame reduction). Flutter still loses on **app size** (15–25% larger memory, ~5–8MB engine baseline) and **cold start** on low-end Android Go. Codegen should avoid: heavy `BackdropFilter` (still expensive on Vulkan-fallback OpenGL), per-frame `Image.network` decodes (use `precacheImage`), `setState` bombs in scroll lists (`const` aggressively, prefer `Selector`/`ValueListenableBuilder`).

## 4. Concrete recommendations

### Day-1 codegen MUST-haves
1. `useMaterial3: true` with `DynamicColorBuilder` + seed-color fallback.
2. `SafeArea` / `MediaQuery.viewInsetsOf` everywhere input had margins/padding from viewport edge.
3. `PopScope` translation for any "confirm-before-close" pattern; default page transitions left at framework default.
4. `aria-*` → `Semantics` mapping; `ExcludeSemantics` for decorative content.
5. `LayoutBuilder` breakpoints from Tailwind responsive variants (≥600dp ≥840dp ≥1200dp).
6. AGP/Gradle template targeting SDK 36, 16KB-aligned, R8 enabled, AAB output, signing via env.
7. CI gate: `flutter analyze` + emulator launch test on API 34 and API 36.
8. `enableOnBackInvokedCallback=true` in manifest, no orientation lock.
9. `flutter build appbundle --obfuscate --split-debug-info`.
10. `const` everywhere we statically can.

### Day-90 stretch
- Foldable hinge handling via `display_features` + `DisplayFeatureSubScreen`.
- Full `fastlane supply` metadata generation from MDX, localized listings, per-density screenshots.
- Baseline Profiles for cold-start improvements on low-end devices.
- Per-screen golden tests on 3 device profiles (phone, foldable unfolded, tablet).
- Play Integrity API attestation hooks for credential forms.
- Wear OS / Auto stubs gated behind feature flag.

### Test strategy
- **Unit:** pure Dart for generated state logic (cubits/notifiers).
- **Widget:** golden tests per generated screen, run with `flutter test --update-goldens` only on Linux CI to avoid font drift.
- **Integration:** `integration_test`, run on `reactivecircus/android-emulator-runner@v2` against API 34 (predictive back) and API 36 (mandatory edge-to-edge). Smoke: launch + first frame + tap primary CTA + assert no exceptions.
- **A11y:** automated `SemanticsTester` assertions per screen — every interactive element must have a non-empty label.

### Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `Padding` instead of `SafeArea`, breaks on Android 16 | High | High | Lint rule in IR → Dart pass; CI screenshot diff on API 36 |
| Predictive back ignored, "confirm close" silently broken | Med | High | `PopScope` translation rule + integration test that swipes back |
| OEM theming (Samsung One UI font scaling, MIUI) breaks layouts | Med | Med | `MediaQuery.textScalerOf` everywhere; cap with `TextScaler.linear(1.0..1.3)` only with user opt-in |
| Foldable unfold reflow loses scroll position / state | Med | Med | Emit `PageStorageKey`s; widget-test the `didChangeMetrics` path |
| 16KB page-size rejection at upload | Low (now) | Critical | Pin Flutter ≥ stable that ships aligned engine; CI assertion via `unzip -l` on `.so` |
| Dynamic color clashes with brand color | Med | Med | Two-track theme; allow MDX frontmatter `disableDynamicColor: true` |
| ProGuard strips a Dart-reflected plugin class → release-only NPE | High first time | High | CI runs release build + `integration_test` against AAB, not just debug |
| Off-thread `Image.network` decode jank on Android Go | Med | Low | Codegen prefers `cached_network_image` + `precacheImage` |

## Open questions for the Flutter agent
1. **IR shape:** typed Dart AST IR (`package:analyzer`-compatible) or JSON IR? Platform rules above (`SafeArea` insertion, `PopScope` wrapping, `Semantics` lifting) are easier as AST passes.
2. **Theme strategy:** one `ThemeData` per app or per screen? Need single root for `DynamicColorBuilder`.
3. **State management default:** `Riverpod`, `bloc`, or `ChangeNotifier`? Affects ProGuard keep-rules.
4. **Plugin set:** curated allowlist (`dynamic_color`, `go_router`, `cached_network_image`, `flutter_localizations`, `intl`) or open?
5. **MDX content surface:** is MDX frontmatter the source of truth for app metadata?
6. **Routing:** `Navigator 2.0` / `go_router`? Predictive-back transitions only behave correctly with `MaterialApp.router` paths.

## Open questions for the iOS agent
1. **Safe area parity:** can we agree on a single `SafeArea`-everywhere convention so codegen has no platform branches in layout?
2. **Theme bridging:** iOS has no Material You. Android branch reads `DynamicColorBuilder` while iOS uses seed-color path?
3. **Back gesture:** iOS swipe-back vs Android predictive-back — both want `PopScope`, but cancel semantics differ.
4. **Accessibility:** same `Semantics` labels driving VoiceOver, or iOS-specific overrides (`Semantics.attributedLabel` for pronunciation)?
5. **Distribution:** unified "channel" abstraction in MDX frontmatter (`channel: internal | beta | production`) for both pipelines?
6. **App size:** Flutter engine ~5–8MB on Android; similar on iOS but App Store thin-binary helps. Match CI size budgets?

## Sources
- [Flutter — Material Design](https://docs.flutter.dev/ui/design/material)
- [Flutter — New ColorScheme roles](https://docs.flutter.dev/release/breaking-changes/new-color-scheme-roles)
- [`dynamic_color`](https://pub.dev/packages/dynamic_color)
- [Flutter — Predictive back gesture](https://docs.flutter.dev/platform-integration/android/predictive-back)
- [Flutter — Default SystemUiMode edge-to-edge](https://docs.flutter.dev/release/breaking-changes/default-systemuimode-edge-to-edge)
- [Mastering Edge-To-Edge in Flutter — LeanCode](https://leancode.co/blog/mastering-edge-to-edge-in-flutter)
- [Flutter Android 16KB Page Size Migration](https://medium.com/@vincentkalu02/android-15-16kb-page-size-migration-for-flutter-complete-guide-to-play-store-publishing-d70ccf1fea33)
- [Flutter — Large screen devices](https://docs.flutter.dev/ui/adaptive-responsive/large-screens)
- [Mastering Accessibility in Flutter — Somnio](https://somniosoftware.com/blog/mastering-accessibility-in-flutter-a-deep-dive-into-semantics)
- [Enable app optimization with R8](https://developer.android.com/build/shrink-code)
- [Flutter Android Deployment Guide 2026 — Izhar Khan](https://medium.com/@izhar-khan/the-flutter-release-gauntlet-part-1-taming-the-green-robot-fa47a9edcf8c)
- [fastlane supply](https://docs.fastlane.tools/actions/supply/)
- [reactivecircus/android-emulator-runner example](https://github.com/abd99/github_actions_integration_tests)
- [Flutter Impeller](https://docs.flutter.dev/perf/impeller)
- [Impeller in 2026](https://dev.to/eira-wexford/how-impeller-is-transforming-flutter-ui-rendering-in-2026-3dpd)
- [State of Flutter 2026](https://devnewsletter.com/p/state-of-flutter-2026/)
- [Flutter vs Jetpack Compose 2026](https://fastbuilder.ai/blog/flutter-vs-jetpack-compose)
- [FlutterFlow Review 2026 — hostadvice](https://hostadvice.com/ai-app-builders/flutterflow-review/)
- [Builder.io — Visual Copilot 1.0 GA](https://www.builder.io/blog/visual-copilot)
- [Tiger Oakes — React to Compose Dictionary](https://tigeroakes.com/posts/react-to-compose-dictionary/)
- [React Native 0.85 Post-Bridge Era](https://criztec.com/react-native-0-85-defines-the-post-bridge-aeme/)
