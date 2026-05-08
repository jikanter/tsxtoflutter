# `fastlane/` — iOS signing + delivery automation

Hand-maintained. Survives `flutter create` regen of `ios/`.

## Files

- `Matchfile` — `match` configuration; reads cert repo URL from env.
- `Fastfile` — lanes: `setup_xcconfigs`, `certs`, `beta`.

## First-run setup

```sh
cd flutter_app
bundle install                       # if you keep a Gemfile; otherwise skip
bundle exec fastlane match init      # one-time, then commit Matchfile
bundle exec fastlane ios certs       # pulls Development certs locally
```

## After every codegen regen of `ios/`

```sh
bundle exec fastlane ios setup_xcconfigs
```

Re-binds `Runner.xcodeproj` to the hand-maintained `ios/Config/*.xcconfig`
files so signing config persists.

## Required environment

| Variable               | Where used                  |
|------------------------|-----------------------------|
| `MATCH_GIT_URL`        | `Matchfile`                 |
| `MATCH_PASSWORD`       | `match` decryption          |
| `DEVELOPMENT_TEAM_ID`  | `Fastfile :setup_xcconfigs` |
| `FASTLANE_USER` / `FASTLANE_PASSWORD` (or App Store Connect API key) | `:beta` |
