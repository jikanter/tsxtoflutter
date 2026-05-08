# flutter_app

The generated Flutter app target. The TS-side `tsxf` CLI drops IR JSON in
`.tsxtoflutter/ir/`; the Dart-side `tsxtoflutter` CLI rewrites
`lib/components/*.g.dart` from there.

## First-time setup

Platform folders (`ios/`, `android/`, `web/`, `macos/`, `windows/`, `linux/`)
are intentionally not committed — Flutter version pins them and they should
be regenerated locally:

```pwsh
flutter create --platforms=web,ios,android --project-name=flutter_app .
flutter pub get
```

## Dev loop

```pwsh
# Terminal 1 — Flutter Web on port 8080:
flutter run -d chrome --web-port=8080

# Terminal 2 — TS-side watcher feeds the IR:
pnpm --filter @tsxtoflutter/cli dev -- watch ../inputs

# Terminal 3 — Dart-side codegen watches the IR:
dart run tsxtoflutter:tsxtoflutter watch --ir .tsxtoflutter/ir --out lib/components
```
