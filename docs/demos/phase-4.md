# Phase 4 — Platform polish (iOS + Android)

*2026-05-08T18:48:46Z by Showboat 0.6.1*
<!-- showboat-id: aaff3ab5-cd60-44fa-82d7-bbad237c995b -->

Phase 4 lays down the Day-1 platform musts on top of the Phase 1–3 pipeline. This demo proves the iOS and Android scaffolding files are in place, the codegen helpers (semantics mapping, iOS adaptive emitters, Android emitters, platform-aware screen wrappers) are tested, the runtime exposes the M3 tonality + adaptive breakpoints, and the CI matrix wires up all three Flutter targets.

## 1. iOS scaffolding (R3) — xcconfigs + Fastlane survive flutter create

```bash
ls flutter_app/ios/Config/ flutter_app/fastlane/
```

```output
flutter_app/fastlane/:
Fastfile
Matchfile
README.md

flutter_app/ios/Config/:
Common.xcconfig
Debug.xcconfig
README.md
Release.xcconfig
```

```bash
grep -E "IPHONEOS_DEPLOYMENT_TARGET|BUNDLE_ID_PREFIX|ENABLE_HARDENED_RUNTIME" flutter_app/ios/Config/Common.xcconfig
```

```output
IPHONEOS_DEPLOYMENT_TARGET = 15.0
BUNDLE_ID_PREFIX = com.example.tsxtoflutter
ENABLE_HARDENED_RUNTIME = YES
```

## 2. Android scaffolding (R7) — Gradle template + manifest + ProGuard

```bash
find flutter_app/android -type f \( -name '*.kts' -o -name '*.xml' -o -name '*.pro' -o -name '*.template' -o -name 'README.md' \) | LC_ALL=C sort
```

```output
flutter_app/android/README.md
flutter_app/android/app/build.gradle.kts
flutter_app/android/app/proguard-rules.pro
flutter_app/android/app/src/main/AndroidManifest.xml
flutter_app/android/key.properties.template
```

```bash
grep -E "compileSdk|targetSdk|minSdk|isMinifyEnabled|isShrinkResources" flutter_app/android/app/build.gradle.kts | head -10
```

```output
//   compileSdk  = 36   (Android 16)
//   targetSdk   = 36   (Play Store mandatory floor as of 2026)
//   minSdk      = 24   (Android 7.0 — covers ~98% of active devices)
    compileSdk = 36
        minSdk = 24
        targetSdk = 36
            isMinifyEnabled = true
            isShrinkResources = true
```

```bash
grep "enableOnBackInvokedCallback" flutter_app/android/app/src/main/AndroidManifest.xml
```

```output
      `enableOnBackInvokedCallback="true"` opts the application into the
        android:enableOnBackInvokedCallback="true">
```

## 3. Codegen helpers — semantics + iOS + Android + platform-aware (R2 / R6 / R8)

```bash
cd packages/codegen && dart test test/semantics_test.dart test/ios_test.dart test/android_test.dart test/platform_aware_test.dart 2>&1 | grep -E "All tests passed|tests passed|Some tests failed|Error" | tail -5
```

```output
00:00 +40: All tests passed!
```

40 codegen tests across the four new modules. The mapping helpers are pure functions — no flutter dependency, no IO — so phase 1's component_emitter can wire them in with a single import once that work lands.

```bash
echo "=== iOS adaptive scrollPhysics expression ===" && grep -A2 "scrollPhysics()" packages/codegen/lib/src/mapping/ios.dart | grep -E "Theme|Bouncing|Clamping" | head -3
```

```output
=== iOS adaptive scrollPhysics expression ===
    return '(Theme.of(context).platform == TargetPlatform.iOS '
        '|| Theme.of(context).platform == TargetPlatform.macOS) '
```

## 4. Runtime — M3 tonality + Material adaptive breakpoints (R5 / R6)

```bash
cd packages/runtime && flutter test test/tokens_test.dart test/breakpoints_test.dart 2>&1 | grep -E "All tests passed|tests passed|Some tests failed" | tail -3
```

```output
00:00 +11: All tests passed!
```

```bash
grep -E "surfaceContainerLowest|surfaceContainerLow|surfaceContainerHigh|outlineVariant|inverseSurface|errorContainer" packages/runtime/lib/src/tokens.dart | grep "final Color"
```

```output
  final Color surfaceContainerLowest;
  final Color surfaceContainerLow;
  final Color surfaceContainerHigh;
  final Color surfaceContainerHighest;
  final Color outlineVariant;
  final Color inverseSurface;
  final Color errorContainer;
```

```bash
grep -E "static const double" packages/runtime/lib/src/breakpoints.dart | grep -v "//" | grep -A0 -E "compact|medium|expanded|large|extraLarge"
```

```output
  static const double compact = 0;
  static const double medium = 600;
  static const double expanded = 840;
  static const double large = 1200;
  static const double extraLarge = 1600;
```

## 5. CI matrix (R9) — Web, iOS simulator, Android emulator

```bash
ruby -ryaml -e 'cfg=YAML.load_file(".github/workflows/ci.yml"); cfg["jobs"].each {|k,v| puts "#{k.ljust(20)} → #{v["runs-on"]} (#{v["name"]})"}'
```

```output
ts                   → ubuntu-latest (TypeScript)
dart                 → ubuntu-latest (Dart codegen)
flutter-web          → ubuntu-latest (Flutter (Web))
flutter-ios          → macos-14 (Flutter (iOS simulator))
flutter-android      → ubuntu-latest (Flutter (Android emulator API ${{ matrix.api-level }}))
```

Both flutter-android matrix legs (API 34 + API 36) and the macOS iOS-sim runner restore hand-maintained files via `git checkout` after `flutter create` regenerates the platform folder, so signing config, gradle pins, and the predictive-back manifest attribute survive every regen.

## 6. Integration smoke harness (R10) — driver bound to all three runners

```bash
ls flutter_app/integration_test/ flutter_app/test/golden/
```

```output
flutter_app/integration_test/:
README.md
smoke_test.dart

flutter_app/test/golden/:
android
ios
README.md
web
```

## 7. Held back behind future phases

Two Phase 4 sub-items still sit downstream of work that hasn't happened yet:

- **R2 iOS scrollable / page-route / haptic injection in codegen.** The helpers in `packages/codegen/lib/src/mapping/ios.dart` are tested in isolation (12 tests) but `widgets.dart` does not yet call them. Doing so would change the `cta.g.dart` golden — phase 1 owns that fixture, so the swap waits for a phase-1-aware variant detector.
- **R4 MDX visitor that calls the privacy emitter.** Phase 1's ingest still emits a `mdx-not-supported` diagnostic for any `.mdx` input. Once an MDX visitor lands, the call to `emitInfoPlistPrivacyStrings` from this branch is a one-liner.

Everything else in Phase 4 — adaptive widgets, M3 token expansion, breakpoints, semantics integration, privacy emitter, CI matrix, integration_test scaffold, signing config — is in-tree and tested.

## 8. Integrated post-merge — Wave 4

After phase-3 merged, two integration steps that had been deferred are now in:

- **R8 codegen wiring** — `emitElement` in `packages/codegen/lib/src/mapping/widgets.dart` now funnels every IRElement through `SemanticsMapping.fromProps` and wraps the result in `Semantics` (or `ExcludeSemantics` when `aria-hidden="true"`). The mapping is a no-op when no aria/role props are present, so the existing cta golden (and any other phase-1 fixture without aria attributes) emits byte-identical Dart.
- **R4 standalone privacy emitter** — `packages/ingest/src/mdx/privacy.ts` exposes `emitInfoPlistPrivacyStrings` + a 19-key `PRIVACY_KEY_BY_PERMISSION` map. The function is pure (in: parsed permissions object, out: plist XML + diagnostics) and ready to be invoked from the MDX visitor when MDX ingestion lands.

```bash
cd packages/codegen && dart test test/widgets_semantics_test.dart 2>&1 | grep -E "All tests passed|tests passed|Some tests failed" | tail -3
```

```output
00:00 +7: All tests passed!
```

```bash
pnpm --filter @tsxtoflutter/ingest test -- privacy 2>&1 | grep -E "Tests  [0-9]+ passed|Test Files  [0-9]+ passed" | tail -3
```

```output
 Test Files  2 passed (2)
      Tests  11 passed (11)
```

```bash
echo "=== Now-handled aria/role props (from emitElement wrapper) ===" && grep -E "case |^\s+test\(" packages/codegen/test/widgets_semantics_test.dart | head -10
```

```output
=== Now-handled aria/role props (from emitElement wrapper) ===
    test('button with aria-label gets Semantics(label:)', () {
    test('button with role=button is idempotent (no double Semantics)', () {
    test('aria-hidden=true wraps in ExcludeSemantics', () {
    test('button with no aria/role props emits unchanged FilledButton', () {
    test('icon with aria-label is wrapped in Semantics', () {
    test('icon with aria-hidden=true is excluded', () {
    test('aria-disabled=true emits Semantics(enabled: false) on a button', () {
```
