import * as t from '@babel/types';
import type {
  IRElement,
  IRNode,
  IRPropValue,
  SemanticTag,
  SourceLoc,
} from '@tsxtoflutter/ir';

import { lookupLucide } from '../components/lucide-map.js';
import { lookupShadcn } from '../components/shadcn-map.js';
import { exprToProp, liftAttrs } from './jsx-attribute.js';

export function jsxElementToIR(el: t.JSXElement, filename: string): IRElement {
  const opening = el.openingElement;
  const name = jsxName(opening.name);
  const loc = locOf(el, filename);

  const lucideIcon = lookupLucide(name);
  if (lucideIcon !== undefined) {
    const lifted = liftAttrs(opening.attributes, filename);
    const props: Record<string, IRPropValue> = {
      ...lifted.props,
      name: { kind: 'literal', value: lucideIcon },
    };
    return {
      kind: 'element',
      tag: 'icon',
      source: { name, loc },
      style: lifted.style,
      props,
      events: lifted.events,
      children: [],
    };
  }

  if (name === 'svg') {
    const lifted = liftAttrs(opening.attributes, filename);
    const props: Record<string, IRPropValue> = {
      ...lifted.props,
      scaffold: { kind: 'literal', value: 'svg' },
    };
    return {
      kind: 'element',
      tag: 'icon',
      source: { name, loc },
      style: lifted.style,
      props,
      events: lifted.events,
      children: [],
    };
  }

  const shadcn = lookupShadcn(name);
  const tag: SemanticTag = shadcn?.tag ?? mapHtmlTag(name);
  const lifted = liftAttrs(opening.attributes, filename);

  const children: IRNode[] = [];
  for (const c of el.children) {
    const node = childToIR(c, filename);
    if (node) children.push(node);
  }

  return {
    kind: 'element',
    tag,
    source: { name, loc },
    style: lifted.style,
    props: lifted.props,
    events: lifted.events,
    children,
  };
}

function childToIR(
  c: t.JSXElement['children'][number],
  filename: string,
): IRNode | undefined {
  if (t.isJSXText(c)) {
    const trimmed = c.value.replace(/\s+/g, ' ');
    if (trimmed.trim() === '') return undefined;
    const loc = locOf(c, filename);
    return loc
      ? { kind: 'text', value: trimmed.trim(), loc }
      : { kind: 'text', value: trimmed.trim() };
  }
  if (t.isJSXElement(c)) {
    return jsxElementToIR(c, filename);
  }
  if (t.isJSXExpressionContainer(c)) {
    if (t.isJSXEmptyExpression(c.expression)) return undefined;
    const e = c.expression;

    if (t.isLogicalExpression(e) && e.operator === '&&') {
      const rhs = jsxExprToIR(e.right, filename);
      if (rhs) {
        return {
          kind: 'conditional',
          test: exprToProp(e.left, filename),
          consequent: rhs,
        };
      }
    }

    if (t.isConditionalExpression(e)) {
      const consequent = jsxExprToIR(e.consequent, filename);
      const alternate = jsxExprToIR(e.alternate, filename);
      if (consequent && alternate) {
        return {
          kind: 'conditional',
          test: exprToProp(e.test, filename),
          consequent,
          alternate,
        };
      }
      // `cond ? <X/> : null|undefined` is the same shape as `cond && <X/>`.
      if (
        consequent &&
        (t.isNullLiteral(e.alternate) ||
          (t.isIdentifier(e.alternate) && e.alternate.name === 'undefined'))
      ) {
        return {
          kind: 'conditional',
          test: exprToProp(e.test, filename),
          consequent,
        };
      }
    }

    const loc = locOf(c, filename);
    const expr = exprToProp(c.expression, filename);
    return loc ? { kind: 'expression', expr, loc } : { kind: 'expression', expr };
  }
  if (t.isJSXFragment(c)) {
    const children: IRNode[] = [];
    for (const cc of c.children) {
      const n = childToIR(cc, filename);
      if (n) children.push(n);
    }
    return { kind: 'fragment', children };
  }
  return undefined;
}

function jsxExprToIR(
  e: t.Expression,
  filename: string,
): IRNode | undefined {
  if (t.isJSXElement(e)) return jsxElementToIR(e, filename);
  if (t.isJSXFragment(e)) {
    const children: IRNode[] = [];
    for (const cc of e.children) {
      const n = childToIR(cc, filename);
      if (n) children.push(n);
    }
    return { kind: 'fragment', children };
  }
  return undefined;
}

function jsxName(n: t.JSXOpeningElement['name']): string {
  if (t.isJSXIdentifier(n)) return n.name;
  if (t.isJSXMemberExpression(n)) {
    return `${jsxName(n.object)}.${n.property.name}`;
  }
  if (t.isJSXNamespacedName(n)) {
    return `${n.namespace.name}:${n.name.name}`;
  }
  return 'Unknown';
}

function mapHtmlTag(name: string): SemanticTag {
  switch (name) {
    case 'div':
    case 'section':
    case 'main':
    case 'header':
    case 'footer':
    case 'article':
      return 'stack';
    case 'span':
      return 'text-inline';
    case 'p':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'text';
    case 'img':
      return 'image';
    case 'button':
      return 'button';
    case 'a':
      return 'link';
    case 'input':
      return 'input';
    case 'textarea':
      return 'textarea';
    case 'hr':
      return 'divider';
    case 'ul':
    case 'ol':
      return 'list';
    case 'li':
      return 'list-item';
    default:
      return 'unknown';
  }
}

function locOf(n: t.Node, filename: string): SourceLoc {
  return {
    file: filename,
    line: n.loc?.start.line ?? 0,
    col: n.loc?.start.column ?? 0,
  };
}
