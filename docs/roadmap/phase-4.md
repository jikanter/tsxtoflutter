# Phase 4 — Platform polish


**Status:** ✅ Done with some deferrals. Recorded here so later phases have a known-good starting state.
**Window:** weeks 10–12.

**Goal:** Day-1 platform musts on iOS and Android, with a CI matrix that exercises all three Flutter targets (Web, iOS simulator, Android emulator) on every PR. The Button fixture (and the broader 50-fixture corpus from Phase 3) must render with platform-appropriate chrome on each.

**Depends on:** Phase 3 exit criterion.

## Pre-work

- [ ] Generate platform folders (not committed in Phase 0; Flutter version pins them):
  ```pwsh
  cd flutter_app
  flutter create --platforms=ios,android .
  ```
- [ ] Phase 0 `flutter_app/pubspec.yaml` already constrains `sdk: ^3.6.0` / `flutter: ^3.27.0`. Verify against the upgraded local toolchain (Flutter 3.41.9 / Dart 3.11.5 at the time of Phase 4 kickoff); bump the floor if a Phase 4 dependency requires it.

## iOS requirements

### R1 — Adaptive widget library extension (`packages/runtime`) ✅ _(landed early in the parallel epic)_

- [x] `AppNavBar`, `AppListTile`, `AppDialog` alongside existing `AppButton` / `AppSwitch` / `AppScaffold`. Files: `lib/src/adaptive/{app_nav_bar,app_list_tile,app_dialog}.dart`. Eight `flutter_test` widget tests assert the Material-on-Android / Cupertino-on-iOS branching plus `AppDialog.show()` action-value plumbing.
- [x] Each branches on `Theme.of(context).platform`. **No `Platform.isIOS ? ... : ...` ternaries in user-facing code.** `AppNavBar` implements `PreferredSizeWidget` so it slots into `AppScaffold.appBar`. `AppDialog.show<T>()` returns the chosen action's `value` for either platform.
- [ ] Cupertino flavoring opt-in via MDX frontmatter `platform: "ios-native"` — _MDX frontmatter routing is still TODO; the runtime widgets exist and are ready to be selected by codegen._

### R2 — Codegen iOS-aware emission (`packages/codegen`)

- [ ] iOS scrollables emit `BouncingScrollPhysics()`.
- [ ] Forward navigation emits `CupertinoPageRoute` (under adaptive shim) when target is iOS.
- [ ] Primary actions emit `HapticFeedback.lightImpact()`; destructive emit `mediumImpact()`.
- [ ] Every generated screen wraps body in `SafeArea` (top + bottom). Compatible with notch / Dynamic Island.
- [ ] `MediaQuery.viewInsetsOf(context)` for IME; `Scaffold.resizeToAvoidBottomInset: true` default.
- [ ] Icon-only buttons emit `tooltip:` (VoiceOver reads tooltip as label).
- [ ] No fixed-height text containers — Dynamic Type clipping is App Review smell.

### R3 — iOS toolchain pin

- [ ] Xcode 26 / iOS 26 SDK pinned in `flutter_app/ios/`.
- [ ] Deployment target: iOS 15.
- [ ] SPM-first; CocoaPods only where SPM unavailable.
- [ ] `flutter_app/ios/Config/{Debug,Release}.xcconfig` template — **hand-maintained, never overwritten by regen**. Documented in `flutter_app/ios/Config/README.md`.
- [ ] `flutter_app/fastlane/Matchfile` scaffolded so signing survives regen.

### R4 — App Store privacy

- [ ] `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSLocationWhenInUseUsageDescription`, etc. generated from MDX frontmatter (`permissions: { camera: "Take a photo of …" }`) into `Info.plist`.
- [ ] Missing required strings → hard codegen error pointing at the offending fixture frontmatter.

## Android requirements

### R5 — Material 3 dynamic color (`packages/runtime` + `flutter_app/lib/main.dart`)

- [ ] `useMaterial3: true` + `DynamicColorBuilder` already shipped in Phase 0; extend `AppTokens` mapping to cover the full M3 role set: `surfaceContainer{,Lowest,Low,High,Highest}`, `outlineVariant`, `inverseSurface`, `inversePrimary`, error roles.
- [ ] Seed-color fallback wired when `DynamicColorBuilder` returns null.

### R6 — Codegen Android-aware emission

- [ ] `PopScope` (not `WillPopScope`) for any "confirm-before-close" pattern; required by Android 15+ predictive back.
- [ ] Tailwind responsive variants (`md:`, `lg:`, `xl:`) → `LayoutBuilder` breakpoints (≥ 600 dp, ≥ 840 dp, ≥ 1200 dp). Constants live in `packages/runtime/lib/breakpoints.dart`.
- [ ] `enableOnBackInvokedCallback="true"` in `flutter_app/android/app/src/main/AndroidManifest.xml`.

### R7 — Android Gradle template

- [ ] `compileSdk = 36`, `targetSdk = 36`, `minSdk = 24`.
- [ ] R8 enabled for release; AAB output configured.
- [ ] 16 KB page-size aligned (Android 15+ requirement on 64-bit).
- [ ] `key.properties` + `signingConfig` populated **from env vars** (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`); never baked into Gradle.
- [ ] ProGuard keep-rules pre-written per closed-widget-catalog plugin.

## Cross-cutting

### R8 — `aria-*` → `Semantics`

- [ ] Mapping table from `docs/research/03-android-platform.md` and `04-ios-platform.md` implemented in `packages/codegen/lib/src/mapping/semantics.dart`.
- [ ] Coverage: `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-hidden`, `aria-pressed`, `aria-expanded`, `aria-disabled`, `role="button"`, `role="heading"`, `role="link"`.

### R9 — CI matrix (`.github/workflows/ci.yml`)

- [ ] **macOS runner:** boot iPhone 15 simulator (iOS 18+); run `flutter test integration_test/`.
- [ ] **Linux runner:** boot Android API 34 + API 36 emulators; run `flutter test integration_test/`.
- [ ] **Existing Web job** continues with `flutter build web --wasm`.
- [ ] All three target builds green-required on every PR.
- [ ] `tsxf eval --corpus packages/tsx-fixtures --platforms web,ios,android` enforces parity.

### R10 — Fixture corpus parity

- [ ] All 50 Phase-3 fixtures must render correctly under all three targets.
- [ ] Per-platform golden screenshots stored under `flutter_app/test/golden/{web,ios,android}/`.
- [ ] Visual diff tolerance ≤ 0.1% pixel delta per fixture.

## File map

```
packages/runtime/lib/{app_nav_bar,app_list_tile,app_dialog}.dart
packages/codegen/lib/src/mapping/{ios.dart, android.dart, semantics.dart}
packages/codegen/lib/src/emitter/platform_aware.dart

flutter_app/ios/Config/{Debug.xcconfig, Release.xcconfig, README.md}
flutter_app/ios/Runner/Info.plist                (privacy strings, generated section)
flutter_app/fastlane/Matchfile

flutter_app/android/app/build.gradle.kts          (compileSdk=36, R8, AAB, page-aligned)
flutter_app/android/app/src/main/AndroidManifest.xml
flutter_app/android/key.properties.template
flutter_app/android/app/proguard-rules.pro

flutter_app/integration_test/                     (per-fixture smoke tests)
flutter_app/test/golden/{web,ios,android}/
.github/workflows/ci.yml                          (extend matrix)
```

## Constraints

- **Hard:** components compile for iOS / Android / Web — Phase 4 makes the matrix CI-enforced.
- **Hard:** platform-specific extensions replicated across iOS, Android, Web.
- **Hard:** xcconfigs are hand-maintained; codegen never touches them.
- **Hard:** signing credentials only via env vars; never committed.

## Risks

- iOS simulator boot in CI is flaky and slow. Mitigation: cache simulator artifacts; mark integration tests as a separate required check so flake retries don't block other gates.
- 16 KB page-size alignment can break native plugins. Mitigation: add a CI step that runs `zipalign -c -P 16 -v 4` against the AAB; fail loudly with the offending plugin name.
- `DynamicColorBuilder` returns null on Android < 12. Mitigation: seed-color fallback already required (R5); add a widget test for the fallback path.

## Exit criterion

Button fixture (and the rest of the Phase-3 corpus) renders correctly with platform-appropriate chrome on Flutter Web, iOS simulator, and Android emulator. CI passes the full matrix on every PR.
