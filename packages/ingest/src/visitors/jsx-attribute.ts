import * as t from '@babel/types';
import _generate from '@babel/generator';
import type {
  IREventHandler,
  IRPropValue,
  NormalizedStyle,
  SourceLoc,
} from '@tsxtoflutter/ir';

import { classesToStyle } from '../styles/tailwind.js';

// `@babel/generator` ships its CJS default export differently across bundlers.
const generate = (
  (_generate as unknown as { default?: typeof _generate }).default ?? _generate
) as typeof _generate;

export interface LiftedAttrs {
  props: Record<string, IRPropValue>;
  events: IREventHandler[];
  className: string | undefined;
  style: NormalizedStyle;
}

export function liftAttrs(
  attrs: Array<t.JSXAttribute | t.JSXSpreadAttribute>,
  filename: string,
): LiftedAttrs {
  const props: Record<string, IRPropValue> = {};
  const events: IREventHandler[] = [];
  let className: string | undefined;
  let style: NormalizedStyle = {};

  for (const a of attrs) {
    if (t.isJSXSpreadAttribute(a)) continue;
    if (!t.isJSXIdentifier(a.name)) continue;
    const name = a.name.name;

    if (name === 'className') {
      const v = jsxAttrToString(a.value);
      if (v !== undefined) {
        className = v;
        style = classesToStyle(v);
      }
      continue;
    }

    if (/^on[A-Z]/.test(name)) {
      const handler = jsxAttrToHandler(a.value, filename);
      if (handler) {
        events.push({ name: mapEventName(name), handler });
      }
      continue;
    }

    const prop = jsxAttrToProp(a.value, filename);
    if (prop) props[name] = prop;
  }

  return { props, events, className, style };
}

function jsxAttrToString(v: t.JSXAttribute['value']): string | undefined {
  if (!v) return undefined;
  if (t.isStringLiteral(v)) return v.value;
  if (t.isJSXExpressionContainer(v) && t.isStringLiteral(v.expression)) {
    return v.expression.value;
  }
  return undefined;
}

function jsxAttrToProp(
  v: t.JSXAttribute['value'],
  filename: string,
): IRPropValue | undefined {
  if (!v) return { kind: 'literal', value: true };
  if (t.isStringLiteral(v)) return { kind: 'literal', value: v.value };
  if (t.isJSXExpressionContainer(v)) {
    if (t.isJSXEmptyExpression(v.expression)) return undefined;
    return exprToProp(v.expression, filename);
  }
  return undefined;
}

function jsxAttrToHandler(
  v: t.JSXAttribute['value'],
  filename: string,
): IREventHandler['handler'] | undefined {
  if (!v) return undefined;
  if (!t.isJSXExpressionContainer(v)) return undefined;
  if (t.isJSXEmptyExpression(v.expression)) return undefined;
  if (t.isIdentifier(v.expression)) {
    return { kind: 'paramRef', name: v.expression.name };
  }
  const loc = locOf(v.expression, filename);
  const handler: IREventHandler['handler'] = loc
    ? { kind: 'expression', raw: rawOf(v.expression), loc }
    : { kind: 'expression', raw: rawOf(v.expression) };
  return handler;
}

export function exprToProp(
  e: t.Expression | t.JSXEmptyExpression,
  filename: string,
): IRPropValue {
  if (t.isStringLiteral(e)) return { kind: 'literal', value: e.value };
  if (t.isNumericLiteral(e)) return { kind: 'literal', value: e.value };
  if (t.isBooleanLiteral(e)) return { kind: 'literal', value: e.value };
  if (t.isNullLiteral(e)) return { kind: 'literal', value: null };
  if (t.isIdentifier(e)) return { kind: 'paramRef', name: e.name };
  if (t.isMemberExpression(e) && !e.computed && t.isIdentifier(e.property)) {
    const path: string[] = [e.property.name];
    let head: t.Expression | t.Super = e.object;
    while (
      t.isMemberExpression(head) &&
      !head.computed &&
      t.isIdentifier(head.property)
    ) {
      path.unshift(head.property.name);
      head = head.object;
    }
    if (t.isIdentifier(head)) {
      return { kind: 'memberRef', object: head.name, path };
    }
  }
  const loc = locOf(e, filename);
  if (loc) return { kind: 'expression', raw: rawOf(e), loc };
  return { kind: 'expression', raw: rawOf(e) };
}

function rawOf(n: t.Node): string {
  return generate(n, { compact: true, comments: false }).code;
}

function locOf(n: t.Node, filename: string): SourceLoc | undefined {
  return n.loc
    ? { file: filename, line: n.loc.start.line, col: n.loc.start.column }
    : undefined;
}

function mapEventName(propName: string): string {
  switch (propName) {
    case 'onClick':
    case 'onTap':
    case 'onPress':
      return 'tap';
    case 'onChange':
      return 'change';
    case 'onSubmit':
      return 'submit';
    case 'onFocus':
      return 'focus';
    case 'onBlur':
      return 'blur';
    case 'onLongPress':
      return 'longPress';
    default:
      return propName.slice(2, 3).toLowerCase() + propName.slice(3);
  }
}
