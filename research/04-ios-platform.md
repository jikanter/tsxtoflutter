# iOS Concerns for the TSX → Flutter Codegen Pipeline

**Author:** iOS engineer agent (Opus) · **Date:** 2026-05-08

Flutter is fine as the target — but iOS is where we will get rejected, look cheap, or fail review. Here is what the codegen must own day one.

## 1. Cupertino vs Material — the rendering decision

**Recommendation: emit Material as the structural default, with a thin `PlatformAdaptive*` wrapper layer the generator targets.** Do *not* emit `Platform.isIOS ? CupertinoFoo() : MaterialBar()` ternaries in user code — brittle, bloats output. Instead, generate against a small in-repo widget library (`AppButton`, `AppSwitch`, `AppNavBar`, `AppScaffold`) whose implementation uses `.adaptive()` constructors (`Switch.adaptive`, `Slider.adaptive`, `CircularProgressIndicator.adaptive`) and `Theme.of(context).platform` underneath.

Why not pure Cupertino? TSX from Claude Design is overwhelmingly web-conventional (rectangular cards, custom typography, density that doesn't match HIG). Forcing Cupertino on web-shaped layouts produces uncanny-valley iOS output. Material widgets honor iOS dark mode and dynamic colors fine; the *interaction primitives* (switches, sliders, alert dialogs, action sheets, page transitions) are what need to be Cupertino on iOS. Constrain the adaptive surface area to those.

**MDX hint protocol:** when design author writes `platform: "ios-native"` or uses iOS-flavored components (`<ActionSheet>`, `<NavBarLargeTitle>`), codegen escalates that subtree to Cupertino-first.

## 2. Safe area, Dynamic Island, home indicator

Every generated screen wrapped in `SafeArea` (top + bottom on by default). `Scaffold.extendBodyBehindAppBar` should be **off** unless TSX explicitly uses translucent header. Use `MediaQuery.of(context).padding` for hero/banner regions that need to extend under notch but keep content in safe rect. Dynamic Island doesn't need special handling for layout — `SafeArea` already handles it — but Live Activities require native plugin (`live_activities`) and should be **out of scope for v1**.

## 3. iOS 26 / Liquid Glass

Flutter team publicly stated June 2025 that they are **not** implementing Liquid Glass in the Cupertino library and will not accept contributions ([flutter#170310](https://github.com/flutter/flutter/issues/170310)). Community packages (`liquid_glass_renderer`, `liquid_glass`) are shader-based fakes. **Do not opt in by default.** When TSX uses `backdrop-filter: blur(...)` or glassy aesthetic, emit `BackdropFilter` + tinted overlay — close enough, no native dependency. Document that "true Liquid Glass requires platform views and is a v2 feature."

## 4. iOS 26 SDK requirement — non-negotiable

**Starting April 28, 2026, all App Store submissions must be built with iOS 26 SDK / Xcode 26.** Deployment target is separate decision — set to **iOS 15.0** (the SPM floor) on Flutter 3.44+, which makes SPM the default and lets us drop most CocoaPods friction. Firebase stops publishing to CocoaPods October 2026 — SPM is the future. arm64-only, bitcode disabled (Apple removed it).

## 5. Accessibility — VoiceOver, Dynamic Type, Reduce Motion

ARIA → Flutter `Semantics` mapping, generated automatically:

- `aria-label` → `Semantics(label: ...)`
- `aria-hidden="true"` → `ExcludeSemantics(child: ...)`
- `role="button"` → `Semantics(button: true, ...)`
- `role="heading"` + `aria-level` → `Semantics(header: true)` (Flutter has no level granularity — accept the loss)
- `aria-live="polite"` → `Semantics(liveRegion: true)`

Two iOS-specific traps:
1. Icon-only buttons must emit a `tooltip:` — VoiceOver reads the tooltip as label.
2. Text widgets must use `MediaQuery.textScalerOf(context)` and avoid hardcoded heights, or Dynamic Type clipping is an instant App Review smell. **Codegen should never emit fixed-height text containers.**

Reduce Motion: query `MediaQuery.disableAnimations` and gate Hero / page transitions accordingly.

## 6. Haptics, scroll physics, navigation

- Scroll physics on iOS is famously over-damped in Flutter ([flutter#32448](https://github.com/flutter/flutter/issues/32448)). Use `BouncingScrollPhysics()` on iOS, `ClampingScrollPhysics()` on Android — wire into adaptive `AppScrollView`.
- Page transitions: emit `CupertinoPageRoute` on iOS so swipe-back works. Known bug: first push lacks shrink animation ([flutter#44864](https://github.com/flutter/flutter/issues/44864)). Live with it.
- `CupertinoSliverNavigationBar` large titles have transition jank ([flutter#67269](https://github.com/flutter/flutter/issues/67269)). **Do not emit large-title nav bars by default** — only when MDX requests `<NavBarLargeTitle>` explicitly.
- Haptics: any TSX `onClick` on a primary action emits `HapticFeedback.lightImpact()`. Destructive actions get `HapticFeedback.mediumImpact()`. Web has no analog — pure iOS uplift.
- Keyboard animation in Flutter re-runs layout every frame instead of riding `CAAnimation` on GPU. Emit `resizeToAvoidBottomInset: true` and avoid expensive widgets above keyboard (no shadows, no `BackdropFilter` siblings).

## 7. Build, signing, distribution

**Project structure that survives regen** — single most important architectural decision:

```
ios/
  Runner.xcodeproj/        ← regenerated every codegen run
  Runner/
    Info.plist             ← regenerated
  Config/                  ← HAND-MAINTAINED, never overwritten
    Release.xcconfig       ← bundle id, team id, version
    Debug.xcconfig
    ExportOptions.plist
  fastlane/                ← HAND-MAINTAINED
    Matchfile
    Fastfile
```

`Runner.xcodeproj` references xcconfigs via `#include`. Codegen **regenerates `Runner.xcodeproj` clean every run** but never touches `ios/Config/` or `ios/fastlane/`. Code signing set to "Manual" via xcconfig, with `PROVISIONING_PROFILE_SPECIFIER` and `DEVELOPMENT_TEAM` pointing at `match`-managed profiles. Only durable answer to "regen nukes my signing config."

**fastlane deliver from MDX**: yes, generate `metadata/en-US/{name,subtitle,description,keywords}.txt` from MDX frontmatter. App Store screenshots from golden snapshots.

**CI minimum**: `macos-14` GitHub runner, `subosito/flutter-action`, `futureware-tech/simulator-action@v5` to boot iPhone 15 simulator, `flutter build ios --simulator --no-codesign`, then `flutter test integration_test/`. ~6 minute runner, ~$0.08 per PR. Don't run signed builds on PRs; reserve for tag pushes.

## 8. Existing tooling — what we can and cannot learn from

- **Recos** ([cgspine/Recos](https://github.com/cgspine/Recos)) — TSX → Compose + SwiftUI compiler. Experimental. Worth reading their AST normalization but their runtime model (JS bridge) is wrong path for us.
- **Skip.tools** — SwiftUI → Compose transpiler, fully OSS Jan 2026. **Lesson:** their two-pass IR (sync `@State`/`@EnvironmentObject` to platform state, then translate `@ViewBuilder` → `@Composable`) is the *right* architecture. We should build a similar IR: TSX → typed widget IR → Dart emitter, never TSX → Dart directly.
- **Locofy / Anima / Builder.io** — Figma → Flutter output is "20–40% manual refinement needed for production." iOS-specific failure mode: *zero* Cupertino awareness — they emit Material everywhere. We can beat that bar trivially by detecting iOS-flavored intent and routing through adaptive widgets.
- **Expo UI** — 1:1 SwiftUI primitives from JS. Different tradeoff (RN, not Flutter). Confirms industry trend: don't simulate, map.

## 9. Day-one iOS checklist — every generated app must

1. Wrap every screen body in `SafeArea`, top+bottom.
2. Use adaptive widgets (`AppButton`, `AppSwitch`, `AppScaffold`) — never raw `Switch`/`Cupertino*` in generated screens.
3. Emit `BouncingScrollPhysics` on iOS scrollables.
4. Emit `CupertinoPageRoute` for forward navigation; preserve swipe-back.
5. Emit `Semantics` from every ARIA attribute; tooltip on every icon-only button.
6. Respect `MediaQuery.textScaler` everywhere — no fixed text heights.
7. Light haptic on primary actions.
8. Deployment target iOS 15, built with iOS 26 SDK, SPM-first.
9. `Runner.xcodeproj` regenerated; `ios/Config/*.xcconfig` and `ios/fastlane/` untouched.
10. App icon, launch screen, `Info.plist` privacy strings (`NSCameraUsageDescription` etc.) generated from MDX frontmatter — missing privacy strings are top App Review rejection.

## 10. Test strategy

- **Unit/widget**: standard `flutter_test`.
- **Golden snapshots**: per screen, light + dark, iPhone 15 + iPhone SE 3 + iPad mini. Use `alchemist` or vanilla goldens. Goldens double as App Store screenshot source.
- **Integration smoke**: boot every screen, run `flutter test integration_test`, assert no exceptions and ≥1 frame rendered. Catches 80% of "generator emitted broken Dart" failures.
- **VoiceOver smoke**: dump semantics tree via `tester.semantics`, assert no unlabeled `button: true` nodes. Cheapest a11y regression test.

## 11. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| App Review rejection: missing privacy strings | High | High | Generate from MDX, lint pre-build |
| App Review rejection: minimum-functionality (4.2.2) on TSX-mockup output | High | High | Require MDX to declare ≥1 native capability or block submission |
| Signing config nuked on regen | Certain if naive | High | xcconfig + match, project file disposable (above) |
| iOS 26 SDK deadline missed | Medium | Catastrophic | Pin Xcode 26 in CI, fail builds on older SDKs |
| Cupertino dissonance (web-shaped TSX feels wrong on iOS) | High | Medium | Adaptive layer + MDX `platform:` hint |
| Liquid Glass requested, fakery looks bad | Medium | Low | Emit `BackdropFilter`, document v2 |
| Large-title nav bar jank | Certain if used | Low | Don't emit by default |
| Keyboard stutter on text-heavy screens | Medium | Medium | `resizeToAvoidBottomInset` + no shadows above keyboard |
| Dynamic Type clipping | High on stock TSX | Medium | Lint pass: ban fixed-height text containers |

## Open questions for the Flutter agent

1. **IR shape.** TSX → typed widget IR → Dart emitter (Skip-style two-pass) — agree? Push adaptive routing into IR-to-Dart phase, not emitted user code.
2. **Adaptive widget library.** Where does `AppButton`/`AppSwitch`/`AppScaffold` shim live? In generated app (per-project) or in shared `tsxtoflutter_widgets` package generator pins?
3. **MDX frontmatter schema.** Need agreement on `platform`, `ios.deploymentTarget`, `ios.requiresLiveActivities`, `ios.privacy.*` keys. Can you own the frontmatter schema doc?
4. **Theming.** How are Tailwind/CSS tokens mapped to `ThemeData` *and* `CupertinoThemeData`?
5. **Hot reload during codegen iteration.** Generator emits incrementally so `flutter run` can hot-reload, or every regen full rebuild?
6. **Asset pipeline.** Who owns generating `@2x`/`@3x` for iOS and `Assets.xcassets/AppIcon.appiconset` from single source image?

## Open questions for the Android agent

1. **Material 3 vs Material You vs adaptive.** If iOS routes through `.adaptive()`, what does Android emit? Pure Material 3, or do we double-skin?
2. **Predictive back gesture.** Android 14+ predictive back conflicts with `CupertinoPageRoute`'s swipe-back metaphor. Handle Android-side, or shared `AppPageRoute`?
3. **Edge-to-edge / system bars.** Android 15 mandates edge-to-edge. iOS `SafeArea` defaults need to compose cleanly with `SystemUiOverlayStyle`.
4. **Min SDK floor.** I'm at iOS 15. What's your `minSdk`?
5. **Signing parity.** xcconfig + fastlane match here. Gradle properties + Play Integrity there? Same regen-survival principle.
6. **Live Activities ↔ Now Bar.** Shared `live_activity` Flutter abstraction or platform-specific?

## Sources

- [Flutter platform adaptations](https://docs.flutter.dev/ui/adaptive-responsive/platform-adaptations)
- [Decoupling Material and Cupertino](https://www.freecodecamp.org/news/decoupling-material-and-cupertino-in-flutter/)
- [adaptive_platform_ui](https://pub.dev/packages/adaptive_platform_ui)
- [Flutter on latest iOS](https://docs.flutter.dev/platform-integration/ios/ios-latest)
- [flutter#170310 — Liquid Glass](https://github.com/flutter/flutter/issues/170310)
- [Apple's Liquid Glass UI: Flutter Will Struggle](https://iamvishnu.com/posts/liquid-glass-and-flutter)
- [pub.dev/liquid_glass](https://pub.dev/packages/liquid_glass)
- [Apple — upcoming SDK requirements](https://developer.apple.com/news/upcoming-requirements/)
- [iOS 26 SDK is now mandatory](https://dev.to/arshtechpro/ios-26-sdk-is-now-mandatory-here-is-what-actually-changes-for-your-app-39m4)
- [Flutter SPM for app developers](https://docs.flutter.dev/packages-and-plugins/swift-package-manager/for-app-developers)
- [DCM — Practical Accessibility in Flutter](https://dcm.dev/blog/2025/06/30/accessibility-flutter-practical-tips-tools-code-youll-actually-use/)
- [Sarunw — Flutter Safe Area](https://sarunw.com/posts/flutter-safe-area/)
- [flutter#32448 — iOS scroll physics](https://github.com/flutter/flutter/issues/32448)
- [flutter#44864 — CupertinoPageRoute first-push transition](https://github.com/flutter/flutter/issues/44864)
- [flutter#67269 — CupertinoSliverNavigationBar largeTitle](https://github.com/flutter/flutter/issues/67269)
- [fastlane match](https://docs.fastlane.tools/actions/match/)
- [Automate Flutter iOS Releases with Fastlane](https://medium.com/nammaflutter/automate-flutter-ios-releases-to-the-app-store-using-fastlane-step-by-step-guide-6a935f6c6b10)
- [futureware-tech/simulator-action](https://github.com/marketplace/actions/launch-ios-simulator)
- [App Store requirements 2026](https://newly.app/articles/app-store-requirements)
- [cgspine/Recos](https://github.com/cgspine/Recos)
- [skiptools/skip](https://github.com/skiptools/skip)
- [Skip fully open-sourced Jan 2026](https://www.infoq.com/news/2026/01/swift-skip-open-sourced/)
- [Expo UI — SwiftUI from RN](https://docs.expo.dev/guides/expo-ui-swift-ui/)
- [Locofy — Figma to Flutter](https://www.locofy.ai/convert/figma-to-flutter)
