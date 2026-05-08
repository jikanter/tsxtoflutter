# `ios/Config/` — hand-maintained xcconfigs

These files are committed and **never** overwritten by `flutter create` or by
the tsxtoflutter codegen pipeline. They exist so signing identities,
deployment-target pins, and bundle identifiers survive a clean regen of
`Runner.xcodeproj`.

## Files

| File              | Purpose                                                     |
|-------------------|-------------------------------------------------------------|
| `Common.xcconfig` | Shared base — toolchain pins, bundle prefix, Swift version. |
| `Debug.xcconfig`  | Debug overrides — `Manual` signing, `match` Development.    |
| `Release.xcconfig`| Release overrides — `Manual` signing, `match` AppStore.     |

`Runner.xcodeproj` references these via `#include` paths set on the project's
`baseConfigurationReference` for each build configuration. After a regen,
re-bind the references in the Xcode project (one-time per regen — see
`fastlane/Fastfile` `setup_xcconfigs` lane).

## Required environment

| Variable             | Used by             | Notes                                |
|----------------------|---------------------|--------------------------------------|
| `DEVELOPMENT_TEAM_ID`| `Common.xcconfig`   | 10-char Apple Developer Team ID.     |
| `MATCH_PASSWORD`     | `fastlane/Matchfile`| Decrypts the `match` cert repo.      |
| `MATCH_GIT_URL`      | `fastlane/Matchfile`| Private repo holding signing assets. |

The Flutter build itself injects `FLUTTER_BUILD_NAME` and
`FLUTTER_BUILD_NUMBER`; do not set those manually.

## What lives elsewhere

- **Privacy strings** (`NSCameraUsageDescription` etc.) are generated into
  `Runner/Info.plist` from MDX frontmatter — see Phase 4 R4.
- **App Store metadata** (`metadata/en-US/*.txt`) is generated from MDX
  frontmatter into `fastlane/metadata/`.
- **Provisioning profiles + certs** live in the `match` repo, not here.
