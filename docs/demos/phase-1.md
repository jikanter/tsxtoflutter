# Phase 1 — TSX to Flutter happy-path round-trip

*2026-05-08T18:02:41Z by Showboat 0.6.1*
<!-- showboat-id: 214e4d69-65a1-486f-af60-166ddfeeea55 -->

Phase 1's exit criterion: the canonical `Button.tsx` fixture round-trips end-to-end TSX → IR JSON → Dart → rendered Flutter Web widget with no manual intervention. This demo reruns the pipeline from a clean slate and checks every gate.

## 1. The fixture

The canonical fixture is a single shadcn `Button` wrapping a `{label}` and a `<ChevronRight />` icon.

```bash
cat packages/tsx-fixtures/fixtures/Button.tsx
```

```output
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export interface CtaProps {
  label: string;
  onGo: () => void;
}

export function Cta({ label, onGo }: CtaProps) {
  return (
    <Button variant="default" size="lg" className="gap-2" onClick={onGo}>
      {label}
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
}
```

## 2. Ingest — TSX → IR JSON

The TS-side pipeline lowers TSX to a semantic IR. The Vitest snapshot test asserts that `Button.tsx` round-trips through `@tsxtoflutter/ingest` to a fixed IR shape committed at `packages/ingest/__snapshots__/Button.ir.json`.

```bash
pnpm --filter @tsxtoflutter/ingest test 2>&1 | grep -E "passed|failed" | grep -vE "ms\)"
```

```output
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

The lowered IR collapses Tailwind utilities (`gap-2`, `h-4`, `w-4`) into a typed `NormalizedStyle`, lifts the `onClick` handler to a `tap` event, and resolves `<ChevronRight />` via the lucide map. The component ID is the deterministic `sha256(path + exportName + contentHash)`.

```bash
jq '{components: [.components[] | {id, name, params, body: {kind: .body.kind, tag: .body.tag, style: .body.style, eventCount: (.body.events | length), childCount: (.body.children | length)}}]}' packages/ingest/__snapshots__/Button.ir.json
```

```output
{
  "components": [
    {
      "id": "275983f29e5d69cbc29e81afd44bfbb65e19277052001df87aa7c84449a1e0c9",
      "name": "Cta",
      "params": [
        {
          "name": "label",
          "type": {
            "kind": "string"
          }
        },
        {
          "name": "onGo",
          "type": {
            "kind": "callback"
          }
        }
      ],
      "body": {
        "kind": "element",
        "tag": "button",
        "style": {
          "layout": {
            "gap": {
              "kind": "px",
              "value": 8
            }
          }
        },
        "eventCount": 1,
        "childCount": 2
      }
    }
  ]
}
```

## 3. Codegen — IR JSON → Dart pair

The Dart side decodes the IR (closed widget catalog: unknown tags throw at decode time) and emits a hand-editable shell + a regenerated `*.g.dart` joined by `part`/`part of`. `dart_style` formats both.

```bash
cd packages/codegen && dart test 2>&1 | grep -E "All tests passed"
```

```output
00:00 +10: All tests passed!
```

## 4. End-to-end conversion

Run the CLI from a clean slate. `tsxf convert` runs ingest, writes IR JSON to `.tsxtoflutter/ir/`, then spawns the Dart codegen subprocess to emit `flutter_app/lib/components/cta.{dart,g.dart}`.

```bash
rm -rf flutter_app/lib/components/cta.dart flutter_app/lib/components/cta.g.dart .tsxtoflutter/ && bun run apps/cli/src/index.ts convert packages/tsx-fixtures/fixtures/Button.tsx --out flutter_app/lib/components 2>&1 | tail -2 && ls flutter_app/lib/components/
```

```output
Generated 1 widget(s).
cta.dart
cta.g.dart
```

### 4a. Hand-editable shell

Generated only when missing — your edits survive every regen.

```bash
cat flutter_app/lib/components/cta.dart
```

```output
import 'package:flutter/material.dart';

part 'cta.g.dart';

class Cta extends StatelessWidget {
  const Cta({super.key, required this.label, required this.onGo});

  final String label;
  final VoidCallback onGo;

  @override
  Widget build(BuildContext context) => _$CtaBuild(this, context);
}
```

### 4b. Regenerated widget tree

Rewritten on every codegen run; carries the do-not-edit banner.

```bash
cat flutter_app/lib/components/cta.g.dart
```

```output
// GENERATED CODE - DO NOT MODIFY BY HAND
part of 'cta.dart';

Widget _$CtaBuild(Cta widget, BuildContext context) {
  return FilledButton(
    onPressed: widget.onGo,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 8,
      children: [Text(widget.label), const Icon(Icons.chevron_right, size: 16)],
    ),
  );
}
```

## 5. Compile + analyze the Flutter app

The exit criterion: `flutter analyze` exits 0 on the generated component and the widget test pumps the rendered Cta button.

```bash
cd flutter_app && flutter analyze 2>&1 | grep -oE "^(No issues found!|[0-9]+ issue.*)"
```

```output
No issues found!
```

```bash
cd flutter_app && flutter test 2>&1 | grep -E "All tests passed"
```

```output
00:00 +1: All tests passed!
```

## 6. Reproducing this demo

To re-execute every code block and confirm Phase 1 still holds:

```sh
showboat verify docs/demos/phase-1.md
```

Exit 0 means every output above is byte-identical on rerun. (The block above is intentionally not executed — `showboat verify` would recurse.)
