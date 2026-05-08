# TSX → Flutter: ReactJS-Side Architecture

**Author:** ReactJS engineer agent (Opus) · **Date:** 2026-05-08
**Scope:** the ingestion + normalization pipeline that lives upstream of the Flutter codegen.

## 1. Ingestion Strategy

### 1.1 Parser choice — use `@babel/parser`

The instinct is "SWC is 20–90× faster than Babel" — true, and irrelevant here. We are not transpiling node_modules; we are processing one or two screen-sized TSX files emitted by an LLM. Latency is in seconds-of-LLM-output range, not milliseconds-of-parser. What matters is:

- **Plugin ergonomics & Babel ecosystem** — `@babel/traverse`, `@babel/types`, `@babel/generator` are the lingua franca for JSX rewrites.
- **TSX-correct out of the box** — `@babel/parser` with `plugins: ['typescript', 'jsx']` (or `['tsx']`).
- **MDX uses the same estree shape anyway** (via `acorn` + `hast-util-to-estree`), so node shapes line up.

SWC is the right call if you're building Vite/Next-class infra. ts-morph is right when you need TypeScript's type-checker. Compiler API is right when you need type *inference* on JSX expressions — a stretch goal, not v1.

**Recommendation:** `@babel/parser@^7.25` for TSX, `@mdx-js/mdx@^3.1` + `unified@^11` for MDX. Use `tsc --noEmit` as an optional pre-flight lint.

### 1.2 MDX handling

MDX 3 compiles in two stages: **mdast** (markdown tree) → **hast** (HTML tree) with JSX nodes preserved (`mdxJsxFlowElement`, `mdxJsxTextElement`, `mdxFlowExpression`).

For us, the MDX file is *content with embedded React components*. The right move is:

1. Run unified pipeline: `remark-parse` → `remark-mdx` → `remark-rehype` (with `passThrough` for mdx nodes) → stop.
2. Walk the resulting **hast+mdx** tree. Markdown blocks become Flutter `Text`/`RichText` nodes. JSX nodes get handed to the same TSX visitor used in 1.1.

We do **not** go all the way to esast/JSX→`_jsx()` calls — that's optimized for runtime, not for translation. We want the *symbolic* JSX preserved.

### 1.3 Assumptions about Claude Design / Claude mockups output

- **Function components only** in v1 — no classes, `forwardRef`, `memo` HOCs.
- **Tailwind utility classes** dominate styling. Some inline `style={{...}}` for dynamic values. Occasional `cn()` / `clsx()` calls.
- **shadcn/ui primitives** (`Button`, `Card`, `Dialog`, `Input`, `Tabs`) — treat them as **first-class semantic widgets** with a hand-curated mapping table to Flutter Material/Cupertino, not as opaque imports to chase down.
- **lucide-react** icons — map by name to Flutter's `Icons.*` (Material) / a bundled icon set.
- **framer-motion** — flag, don't translate. Animation semantics differ enough that a half-translation is worse than `// TODO(motion): fade-in 200ms`.
- **No data fetching, no Server Components, no Next.js routing** — these are mockups. If we see `'use server'` or `async` components, we strip and warn.

## 2. Normalization Layer — the IR

The IR is the contract with the Flutter codegen. Get this right; everything else is mechanical.

### 2.1 IR node shape

```ts
// packages/ir/src/types.ts
export type IRNode =
  | IRElement
  | IRText
  | IRExpression
  | IRConditional
  | IRList
  | IRFragment
  | IRSlot;

export interface IRElement {
  kind: 'element';
  /** Semantic tag, NOT raw HTML/JSX. e.g. 'button' | 'card' | 'stack' | 'image' */
  tag: SemanticTag;
  /** Original JSX name preserved for debugging/traceability */
  source: { name: string; loc: SourceLoc };
  style: NormalizedStyle;
  props: Record<string, IRPropValue>;
  events: IREventHandler[];
  children: IRNode[];
  /** Things we couldn't translate. Flutter codegen emits as comments + TODO. */
  unsupported?: UnsupportedMarker[];
}

export interface NormalizedStyle {
  layout?: { display?: 'flex'|'grid'|'block'; direction?: 'row'|'col';
             gap?: Length; align?: Align; justify?: Justify; wrap?: boolean };
  box?:    { width?: Length; height?: Length; minW?: Length; maxW?: Length;
             padding?: EdgeInsets; margin?: EdgeInsets; radius?: Radius;
             border?: Border; shadow?: Shadow[]; opacity?: number };
  color?:  { bg?: ColorRef; fg?: ColorRef };
  text?:   { font?: FontRef; size?: Length; weight?: number;
             lineHeight?: Length; letterSpacing?: Length;
             align?: 'left'|'center'|'right'|'justify' };
  /** Variants we couldn't fold (responsive `md:`, `dark:`, `hover:`). */
  variants?: StyleVariant[];
}

export type ColorRef =
  | { kind: 'token'; path: string }
  | { kind: 'literal'; value: string };

export type Length =
  | { kind: 'token'; path: string }
  | { kind: 'px' | 'rem' | 'em' | '%'; value: number }
  | { kind: 'auto' };
```

The IR is **semantic, not structural**. A `<div className="flex flex-col gap-2 p-4 rounded-xl bg-card">` becomes a single `IRElement{ tag: 'stack', style: {...} }`. The Flutter side sees `Column` + `Padding` + `DecoratedBox` directly — no intermediate `<div>` representation to puzzle over.

### 2.2 Style collapsing pipeline

1. **Tailwind class expansion** — use `@tailwindcss/oxide` programmatically. Each utility class → CSS declarations → IR style fields. For `cn(a, b && c)`, partially evaluate.
2. **Inline `style={{...}}`** — last writer wins; `camelCase` → CSS prop name → IR field.
3. **CSS Modules** — parse with `postcss`, resolve the imported identifier to a class hash, look up declarations, merge.
4. **shadcn variants** — when the component is `Button` and `variant="destructive"`, look up the variant tokens from a curated `shadcn-variants.json`. Don't try to read the user's `cva()` calls.

Anything not collapsible (responsive, `dark:`, pseudo-states) lands in `style.variants`.

### 2.3 React-only constructs — translate / flatten / flag

| Construct | Decision | Rationale |
|---|---|---|
| `useState` | **Translate** → Flutter `StatefulWidget` + field | 1:1 |
| `useReducer` | **Translate** → `ValueNotifier` or reducer class | 1:1 |
| `useEffect(fn, [])` | **Translate** → `initState`/`dispose` | Mount semantics align |
| `useEffect(fn, deps)` | **Translate** → `didUpdateWidget` diff | Mechanical |
| `useMemo`/`useCallback` | **Flatten** — drop the memo, inline | Flutter rebuilds differently |
| `useRef` (DOM) | **Flag unsupported** | DOM refs have no analog |
| `useRef` (mutable box) | **Translate** → plain Dart field | Trivial |
| `useContext` | **Translate** → `InheritedWidget` / `Provider` | Direct |
| `createPortal` | **Flag** with TODO → `Overlay`/`showDialog` | Needs human review |
| `forwardRef` / `useImperativeHandle` | **Flag**, strip ref, keep body | Rare in mockups |
| Suspense / `use()` | **Flag**, render fallback | RSC isn't in scope |
| Event handlers | **Translate** | Map to `onTap`/`onChanged` |

## 3. Existing Tooling (May 2026)

- **NTRN** ([github.com/AmeyKuradeAK/ntrn](https://github.com/AmeyKuradeAK/ntrn)) — closest prior art. CLI converting Next.js/React to Flutter. Uses Babel to parse TSX, maps HTML tags to Flutter widgets. Architecture is "string-templates from AST" — the trap we should avoid (output quality plateaus). **Lesson: keep the IR; don't go AST→string directly.**
- **GeekyAnts/react-native-to-flutter** — earlier RN-style→Flutter widget mapping conventions.
- **dart-archive/ts2dart** — archived. TypeScript-syntax-to-Dart-syntax (Angular Dart era).
- **Tamagui** — its compiler hoists styled-components to atomic CSS / hoisted style objects. **Lesson: a normalized style object is the right pivot point.**
- **Lynx** (ByteDance) — React-compatible runtime targeting native. Kept React semantics, swapped renderer; we're doing the inverse.
- **DTCG / W3C Design Tokens** — spec hit **first stable v1 in October 2025** ([w3.org](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)). **Adopt it.** Use `application/design-tokens+json`, consume with **Style Dictionary v4+**. One token file → emits both Tailwind config and Dart `theme.dart`.

### When AST beats LLM, and vice versa

- **AST wins** for: tag mapping, hook lowering, style normalization, prop forwarding, event handler translation, tree shape. Deterministic, testable, 100% reproducible. *This is most of the pipeline.*
- **LLM wins** for: naming Dart classes well from `<UserAvatarMenu>`, generating a plausible Flutter `Animation` from framer-motion, writing sensible `// TODO` comments for unsupported markers, picking between `Material` and `Cupertino` when ambiguous. **Second-pass enrichment over the IR**, not first-pass translator over raw TSX.

## 4. Concrete Recommendations

### File layout

```
packages/
  ingest/                          # TSX + MDX → IR
    src/
      index.ts                     # public: ingest(files) -> IRProgram
      parsers/{tsx,mdx}.ts
      visitors/{jsx-element,jsx-attribute,hooks,conditional,list}.ts
      styles/{tailwind,inline,css-modules,shadcn-variants.json}.ts
      components/{shadcn-map,lucide-map,html-map}.ts
      unsupported.ts
    test/fixtures/                 # *.tsx + expected *.ir.json pairs
  ir/
    src/types.ts                   # the IR types above
    src/schema.ts                  # zod schema for runtime validation
  tokens/
    src/dtcg-to-tailwind.ts        # tokens.json → tailwind.config.ts
    src/dtcg-to-dart.ts            # tokens.json → theme.dart
    tokens/core.tokens.json        # DTCG v1 format
apps/
  cli/                             # tsxtoflutter ingest ./input -> ./out/ir.json
```

### npm dependencies (May 2026)

```jsonc
{
  "@babel/parser": "^7.25.0",
  "@babel/traverse": "^7.25.0",
  "@babel/types": "^7.25.0",
  "@mdx-js/mdx": "^3.1.0",
  "unified": "^11.0.5",
  "remark-parse": "^11.0.0",
  "remark-mdx": "^3.1.0",
  "remark-rehype": "^11.1.0",
  "unist-util-visit": "^5.0.0",
  "tailwindcss": "^4.1.0",
  "@tailwindcss/oxide": "^4.1.0",
  "postcss": "^8.4.0",
  "style-dictionary": "^4.3.0",
  "zod": "^3.23.0"
}
```

Validate the IR at the package boundary with `zod`. The Flutter side reads `ir.json`; if the schema drifts, both sides break loudly.

### Worked example — a shadcn Button

**Input TSX:**

```tsx
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export function Cta({ label, onGo }: { label: string; onGo: () => void }) {
  return (
    <Button variant="default" size="lg" className="gap-2" onClick={onGo}>
      {label}
      <ChevronRight className="h-4 w-4" />
    </Button>
  );
}
```

**Output IR (abridged):**

```json
{
  "kind": "component",
  "name": "Cta",
  "params": [
    { "name": "label", "type": "string" },
    { "name": "onGo", "type": "callback" }
  ],
  "body": {
    "kind": "element",
    "tag": "button",
    "source": { "name": "Button", "loc": { "line": 5, "col": 4 } },
    "style": {
      "layout": { "direction": "row", "gap": { "kind":"rem","value":0.5 }, "align":"center" },
      "box":    { "padding": { "x":{"kind":"rem","value":2}, "y":{"kind":"rem","value":0.625} },
                  "radius":  { "kind":"token","path":"radius.md" } },
      "color":  { "bg": {"kind":"token","path":"color.primary"},
                  "fg": {"kind":"token","path":"color.primary-foreground"} },
      "text":   { "weight": 500, "size": {"kind":"token","path":"font.size.base"} }
    },
    "events": [{ "name": "tap", "handler": { "kind":"paramRef","name":"onGo" } }],
    "children": [
      { "kind": "expression", "expr": { "kind":"paramRef","name":"label" } },
      { "kind": "element", "tag": "icon",
        "props": { "name": "chevron_right" },
        "style": { "box": { "width": {"kind":"px","value":16},
                            "height": {"kind":"px","value":16} } } }
    ]
  }
}
```

The Flutter codegen now has zero ambiguity. It emits a `StatelessWidget` with a `FilledButton` whose `onPressed` wires to the constructor callback, child is a `Row(mainAxisSize: MainAxisSize.min, children: [Text(label), SizedBox(width:8), Icon(Icons.chevron_right, size:16)])`. No JSX, no Tailwind, no React semantics leaked across the seam.

## Key Open Questions for the Flutter Side

1. **Material vs Cupertino vs custom** — does the Flutter codegen pick a base library globally, per-component (driven by an IR hint), or always emit a custom widget set themed via `theme.dart`?
2. **Token consumption** — confirm you'll consume the same DTCG `tokens.json` we emit Tailwind config from, via Style Dictionary's Dart formatter.
3. **Layout primitive mapping** — for `IRElement{tag:'stack', style:{layout:{direction:'row'}}}`, do you emit `Row` directly or always go through `Flex`? For `gap`, do you interleave `SizedBox` or use `Wrap`/`spacing:` (Flutter 3.27+)?
4. **Responsive variants** — `md:`, `lg:` Tailwind breakpoints land in `style.variants`. `LayoutBuilder`-based pattern, `MediaQuery` hook, or custom `Responsive(builder: ...)` widget?
5. **State containers** — for `useContext` lowering, do you prefer `InheritedWidget`, `Provider`, or `Riverpod`? IR currently emits a generic `IRContext` node; pick one and we'll specialize.
6. **Unsupported markers** — what should the IR do when it can't translate (e.g., framer-motion)? Inline TODO comment in Dart? Skip the subtree? Emit a stub widget with a runtime warning?
7. **Two-way iteration** — when Claude Design re-emits a slightly-changed TSX, do you want stable Dart filenames/class names so diffs stay small?
8. **Async/data** — mockups *probably* fake data with literals, but if a `fetch()` or `useQuery()` shows up, do you want a `FutureBuilder` skeleton or a hard error?

## Sources

- [NTRN — Next/React → Flutter](https://github.com/AmeyKuradeAK/ntrn)
- [GeekyAnts react-native-to-flutter](https://github.com/GeekyAnts/react-native-to-flutter)
- [dart-archive/ts2dart](https://github.com/dart-archive/ts2dart)
- [@babel/parser docs](https://babeljs.io/docs/babel-parser)
- [@mdx-js/mdx pipeline](https://mdxjs.com/packages/mdx/)
- [DTCG v1 stable announcement (Oct 2025)](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
- [Style Dictionary DTCG support](https://styledictionary.com/info/dtcg/)
- [Tamagui compiler](https://tamagui.dev/)
- [Lynx](https://lynxjs.org/)
