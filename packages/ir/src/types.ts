/**
 * The IR is the contract between the TSX ingest pipeline and the Dart codegen.
 * It is semantic, not structural: a `<div className="flex flex-col gap-2">` becomes
 * one IRElement{tag:'stack'}, not nested div mirrors.
 */

export interface SourceLoc {
  file: string;
  line: number;
  col: number;
}

export type SemanticTag =
  | 'stack'
  | 'box'
  | 'text'
  | 'text-inline'
  | 'image'
  | 'icon'
  | 'button'
  | 'link'
  | 'input'
  | 'textarea'
  | 'card'
  | 'divider'
  | 'list'
  | 'list-item'
  | 'avatar'
  | 'badge'
  | 'dialog'
  | 'sheet'
  | 'tabs'
  | 'tab'
  | 'fragment'
  | 'unknown';

export type Length =
  | { kind: 'token'; path: string }
  | { kind: 'px' | 'rem' | 'em' | '%'; value: number }
  | { kind: 'auto' };

export type ColorRef =
  | { kind: 'token'; path: string }
  | { kind: 'literal'; value: string };

export interface FontRef {
  family?: string;
  tokenPath?: string;
}

export interface EdgeInsets {
  top?: Length;
  right?: Length;
  bottom?: Length;
  left?: Length;
  x?: Length;
  y?: Length;
}

export interface Radius {
  tl?: Length;
  tr?: Length;
  bl?: Length;
  br?: Length;
  all?: Length;
}

export interface Border {
  width?: Length;
  color?: ColorRef;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface Shadow {
  x: Length;
  y: Length;
  blur: Length;
  spread?: Length;
  color: ColorRef;
}

export type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export interface NormalizedStyle {
  layout?: {
    display?: 'flex' | 'grid' | 'block';
    direction?: 'row' | 'col';
    gap?: Length;
    align?: Align;
    justify?: Justify;
    wrap?: boolean;
  };
  box?: {
    width?: Length;
    height?: Length;
    minW?: Length;
    maxW?: Length;
    minH?: Length;
    maxH?: Length;
    padding?: EdgeInsets;
    margin?: EdgeInsets;
    radius?: Radius;
    border?: Border;
    shadow?: Shadow[];
    opacity?: number;
  };
  color?: {
    bg?: ColorRef;
    fg?: ColorRef;
  };
  text?: {
    font?: FontRef;
    size?: Length;
    weight?: number;
    lineHeight?: Length;
    letterSpacing?: Length;
    align?: 'left' | 'center' | 'right' | 'justify';
  };
  /** Variants we couldn't fold (responsive `md:`, `dark:`, `hover:`, `focus:`). */
  variants?: StyleVariant[];
}

export interface StyleVariant {
  /** e.g. 'breakpoint:md' | 'theme:dark' | 'state:hover' */
  selector: string;
  style: NormalizedStyle;
}

/** Property values, keeping a small typed expression sub-language. */
export type IRPropValue =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'paramRef'; name: string }
  | { kind: 'memberRef'; object: string; path: string[] }
  | { kind: 'expression'; raw: string; loc?: SourceLoc };

export interface IREventHandler {
  /** 'tap' | 'change' | 'submit' | 'focus' | 'blur' | 'longPress' */
  name: string;
  /** Event handlers become widget constructor params. The body is opaque to codegen. */
  handler:
    | { kind: 'paramRef'; name: string }
    | { kind: 'expression'; raw: string; loc?: SourceLoc };
}

export interface UnsupportedMarker {
  /** e.g. 'framer-motion', 'createPortal', 'useImperativeHandle' */
  feature: string;
  loc?: SourceLoc;
  message?: string;
}

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
  tag: SemanticTag;
  source: { name: string; loc: SourceLoc };
  style: NormalizedStyle;
  props: Record<string, IRPropValue>;
  events: IREventHandler[];
  children: IRNode[];
  unsupported?: UnsupportedMarker[];
}

export interface IRText {
  kind: 'text';
  value: string;
  loc?: SourceLoc;
}

export interface IRExpression {
  kind: 'expression';
  expr: IRPropValue;
  loc?: SourceLoc;
}

export interface IRConditional {
  kind: 'conditional';
  test: IRPropValue;
  consequent: IRNode;
  alternate?: IRNode;
}

export interface IRList {
  kind: 'list';
  items: IRPropValue;
  itemBinding: string;
  indexBinding?: string;
  body: IRNode;
}

export interface IRFragment {
  kind: 'fragment';
  children: IRNode[];
}

export interface IRSlot {
  kind: 'slot';
  /** Named children slot (for shadcn-like compound components). */
  name: string;
  children: IRNode[];
}

export type IRType =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'callback' }
  | { kind: 'node' }
  | { kind: 'array'; of: IRType }
  | { kind: 'union'; of: IRType[] }
  | { kind: 'unknown' };

export interface IRComponentParam {
  name: string;
  type: IRType;
  optional?: boolean;
  defaultValue?: IRPropValue;
}

export interface IRComponent {
  kind: 'component';
  /** Stable ID across regens: `${file}:${exportName}` */
  id: string;
  name: string;
  source: SourceLoc;
  params: IRComponentParam[];
  body: IRNode;
  /** State lowered from useState/useReducer/useContext */
  state?: IRStateDecl[];
}

export interface IRStateDecl {
  /** 'state' | 'reducer' | 'effect' | 'context' | 'memo' */
  kind: 'state' | 'reducer' | 'effect' | 'context' | 'memo';
  name: string;
  initial?: IRPropValue;
  /** For effects: the dep array is significant for translation. */
  deps?: IRPropValue[];
  /** Opaque body — translated by LLM fallback when present. */
  body?: { raw: string; loc?: SourceLoc };
}

/** Top-level program emitted by the ingest package. */
export interface IRProgram {
  /** SemVer of the IR shape itself; bump on breaking changes. */
  version: '0.1';
  /** Hash of the inputs that produced this program, for cache keys. */
  inputHash: string;
  /** Pinned ruleset version (TSX→IR translation rules). */
  rulesetVersion: string;
  components: IRComponent[];
  diagnostics: IRDiagnostic[];
}

export interface IRDiagnostic {
  severity: 'info' | 'warn' | 'error';
  code: string;
  message: string;
  loc?: SourceLoc;
}
