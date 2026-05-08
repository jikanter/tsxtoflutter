# `integration_test/` — cross-platform smoke + golden harness

Run on every PR by the Phase 4 CI matrix:

| Runner               | Device                              | Coverage                       |
|----------------------|-------------------------------------|--------------------------------|
| `macos-14`           | iPhone 15 simulator                 | iOS-specific layout + haptics  |
| `ubuntu-latest`      | Android API 34 emulator (pixel_6)   | Predictive back, Material You  |
| `ubuntu-latest`      | Android API 36 emulator (pixel_6)   | Page-size alignment, target SDK |
| (no runner)          | Web (assertion-only)                | Same Dart, no driver           |

## Local commands

```sh
cd flutter_app

# iOS simulator (boot first via Xcode or `simctl`)
flutter test integration_test/ -d 'iPhone 15'

# Android (boot an emulator first via avdmanager / Android Studio)
flutter test integration_test/

# Web (driver-less; only the framework's own assertions)
flutter test integration_test/smoke_test.dart -d chrome
```

## Goldens

Per-platform pixel-diffed screenshots live under `flutter_app/test/golden/{web,ios,android}/`.
Visual diff tolerance: ≤ 0.1% pixel delta per fixture (Phase 4 R10). Update with:

```sh
flutter test --update-goldens test/golden_test.dart
```

Goldens are committed and double as App Store screenshot source.
