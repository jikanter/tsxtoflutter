# Phase 4 — Platform polish


**Status:** ✅ Done with deferrals. Runtime widgets, M3 tonality, codegen helpers, semantics integration, platform scaffolding, and the CI matrix all landed in commit 829c925. Held back: variant-aware injection of iOS/Android emit helpers into `widgets.dart`, the MDX visitor that calls the privacy emitter, and per-platform pixel-diff goldens (deferred to Phase 6's validation overlay). Demo: [docs/demos/phase-4.md](../demos/phase-4.md).
**Window:** weeks 10–12.

**Goal:** Day-1 platform musts on iOS and Android, with a CI matrix that exercises all three Flutter targets (Web, iOS simulator, Android emulator) on every PR. The Button fixture (and the broader 50-fixture corpus from Phase 3) must render with platform-appropriate chrome on each.

**Depends on:** Phase 3 exit criterion.

## Pre-work

- [x] Platform folders generated locally; CI regenerates them per-job via `flutter create --platforms=ios|android` and then restores hand-maintained `xcconfig` / Gradle / manifest files from git.
- [x] `flutter_app/pubspec.yaml` toolchain floor verified against the local Flutter 3.41.9 / Dart 3.11.5; bumps tracked there.

## iOS requirements

### R1 — Adaptive widget library extension (`packages/runtime`) ✅

- [x] `AppNavBar`, `AppListTile`, `AppDialog` alongside existing `AppButton` / `AppSwitch` / `AppScaffold` under `lib/src/adaptive/`. Eight `flutter_test` widget tests assert the Material-on-Android / Cupertino-on-iOS branching plus `AppDialog.show()` action-value plumbing.
- [x] Each branches on `Theme.of(context).platform`. **No `Platform.isIOS ? ... : ...` ternaries in user-facing code.** `AppNavBar` implements `PreferredSizeWidget` so it slots into `AppScaffold.appBar`. `AppDialog.show<T>()` returns the chosen action's `value` for either platform.
- [ ] Cupertino flavoring opt-in via MDX frontmatter `platform: "ios-native"` — runtime widgets are ready to be selected by codegen, but the routing depends on the same MDX visitor that gates R4 privacy emission.

### R2 — Codegen iOS-aware emission (`packages/codegen`) 🟡 helpers shipped, hot-path injection held

- [x] `mapping/ios.dart::IosEmit.scrollPhysics()` returns adaptive `BouncingScrollPhysics` / `ClampingScrollPhysics`.
- [x] `IosEmit.pageRoute(...)` returns adaptive `CupertinoPageRoute` / `MaterialPageRoute`.
- [x] `IosEmit.haptic(HapticIntent)` emits `HapticFeedback.lightImpact|mediumImpact|selectionClick`.
- [x] `emitter/platform_aware.dart` wraps generated screen bodies in `SafeArea` + `MediaQuery.viewInsetsOf`.
- [ ] Helpers are not yet inlined by `mapping/widgets.dart::emitElement` — held back until variant-aware emission lands so existing fixture goldens stay byte-stable. Tracked in 829c925 commit notes.
- [ ] Icon-only-button `tooltip:` requirement and "no fixed-height text containers" Dynamic-Type rule — to lock in once injection lands.

### R3 — iOS toolchain pin ✅

- [x] Xcode 26 / iOS 26 SDK pinned via `flutter_app/ios/Config/Common.xcconfig`.
- [x] Deployment target: `IPHONEOS_DEPLOYMENT_TARGET = 15.0`.
- [x] SPM-first; CocoaPods only where SPM unavailable (documented in `Config/README.md`).
- [x] `Config/{Debug,Release}.xcconfig` hand-maintained; CI restores them with `git checkout HEAD -- ios/Config/` after `flutter create`.
- [x] `fastlane/{Fastfile,Matchfile}` scaffolded; `Matchfile` reads cert repo URL from env.

### R4 — App Store privacy 🟡 emitter shipped, MDX visitor pending

- [x] `packages/ingest/src/mdx/privacy.ts::emitInfoPlistPrivacyStrings` + 19-key `PRIVACY_KEY_BY_PERMISSION` map — pure function from parsed permissions to plist XML + diagnostics; 11 vitest cases.
- [ ] MDX visitor wiring that pulls `frontmatter.permissions` into the emitter — phase-1 ingest still emits an `mdx-not-supported` diagnostic, so the privacy emitter is unreachable from the live pipeline.
- [ ] Hard codegen error on missing required strings — gated behind the MDX visitor above.

## Android requirements

### R5 — Material 3 dynamic color (`packages/runtime` + `flutter_app/lib/main.dart`) ✅

- [x] `useMaterial3: true` + `DynamicColorBuilder` shipped from Phase 0; `AppTokens` extended with `surfaceContainer{,Lowest,Low,High,Highest}`, `outlineVariant`, `inverseSurface`, `inversePrimary`, `errorContainer`, `onErrorContainer`.
- [x] `AppTokens.fromColorScheme` factory wires the seed-color fallback when `DynamicColorBuilder` returns null.

### R6 — Codegen Android-aware emission 🟡 helpers shipped, hot-path injection held

- [x] `mapping/android.dart::AndroidEmit.popScope(...)` wraps a child with `PopScope` (never `WillPopScope`); required-args validation enforced.
- [x] `MaterialBreakpoints` (compact <600 / medium 600 / expanded 840 / large 1200 / extraLarge 1600 dp) + `windowSizeClassFor` + `BuildContext.windowSizeClass` / `isMediumOrWider` in `packages/runtime/lib/src/breakpoints.dart`.
- [x] `enableOnBackInvokedCallback="true"` in `flutter_app/android/app/src/main/AndroidManifest.xml`.
- [ ] `mapping/widgets.dart` does not yet route Tailwind responsive variants (`md:`/`lg:`/`xl:`) through `LayoutBuilder` — held with R2 behind variant-aware emission.

### R7 — Android Gradle template ✅

- [x] `compileSdk=36`, `targetSdk=36`, `minSdk=24` in `flutter_app/android/app/build.gradle.kts`.
- [x] R8 enabled for release; AAB output configured; CI runs `zipalign -c -P 16 -v 4` to enforce 16 KB page-size alignment.
- [x] `key.properties.template` + env-driven `signingConfig` (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`); nothing baked into Gradle.
- [x] `proguard-rules.pro` keep-rules committed.

## Cross-cutting

### R8 — `aria-*` → `Semantics` ✅

- [x] `packages/codegen/lib/src/mapping/semantics.dart::SemanticsMapping.fromProps` covers `aria-label`, `aria-labelledby`, `aria-describedby`, `aria-hidden`, `aria-pressed`, `aria-expanded`, `aria-disabled`, `role="button"`, `role="heading"`, `role="link"`.
- [x] Integrated into `mapping/widgets.dart::emitElement`; no-op when no a11y props so existing fixture goldens stay byte-identical.

### R9 — CI matrix (`.github/workflows/ci.yml`) ✅

- [x] **macOS-14 runner** boots an iPhone 15 simulator (`futureware-tech/simulator-action@v5`), regenerates `ios/`, restores hand-maintained `xcconfig` / `fastlane` from git, runs `flutter analyze` + `flutter test` + `flutter build ios --simulator --no-codesign`, then `flutter test integration_test/` when present.
- [x] **Linux runner** matrix `api-level: [34, 36]` boots Android emulators via `reactivecircus/android-emulator-runner@v2`, regenerates `android/`, restores hand-maintained `build.gradle.kts` / manifest / proguard / `key.properties.template`, runs `flutter analyze` + `flutter test` + `flutter test integration_test/`, then `zipalign` 16 KB enforcement.
- [x] Existing **Web job** continues with `flutter build web --wasm`.
- [ ] `tsxf eval --platforms web,ios,android` parity gate — pending Phase 6's per-platform validators.

### R10 — Fixture corpus parity 🟡 scaffolding only

- [x] `flutter_app/test/golden/{web,ios,android}/` directories scaffolded with `.gitkeep` placeholders.
- [x] `flutter_app/integration_test/smoke_test.dart` boots `App`, asserts ≥1 frame, no exceptions; runs on all three CI runners.
- [ ] Per-fixture pixel-diff goldens — deferred to Phase 6 layer 3 (golden-image tests). Phase 4 stops at scaffolding so the corpus growth + golden capture can land alongside cross-overlay validation.

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

Button fixture (and the rest of the Phase-3 corpus) renders correctly with platform-appropriate chrome on Flutter Web, iOS simulator, and Android emulator. CI passes the full matrix on every PR. **Status:** runtime + scaffolding + matrix all green; per-fixture chrome correctness rides on the held-back variant-aware emission and the Phase 6 cross-overlay layer.
