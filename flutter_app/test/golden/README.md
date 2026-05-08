# `test/golden/` — per-platform pixel goldens

Three subdirectories, one per Flutter target:

- `web/`     — `flutter test --platform chrome`
- `ios/`     — `flutter test -d 'iPhone 15'` (macos-14 CI runner)
- `android/` — `flutter test -d <android-emulator-id>` (ubuntu-latest, API 34 + 36)

## Tolerance

Pixel diff threshold: **0.1%** per fixture. CI fails on any fixture that
exceeds the threshold under any of the three targets. Update with
`flutter test --update-goldens` after a deliberate UI change.

## Pruning

When a fixture is removed, prune the matching goldens from all three
directories. The `tsxf eval` runner emits a warning when an orphaned golden
is detected.
