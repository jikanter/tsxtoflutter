import * as t from '@babel/types';
import type {
  IRComponent,
  IRComponentParam,
  IRDiagnostic,
  IRNode,
  IRType,
  SourceLoc,
} from '@tsxtoflutter/ir';

import { jsxElementToIR } from '../visitors/jsx-element.js';

export interface LoweredComponent {
  component: IRComponent;
  diagnostics: IRDiagnostic[];
}

interface InterfaceTable {
  [name: string]: t.TSInterfaceDeclaration | t.TSTypeLiteral;
}

export function collectInterfaces(file: t.File): InterfaceTable {
  const table: InterfaceTable = {};
  for (const stmt of file.program.body) {
    if (t.isTSInterfaceDeclaration(stmt)) {
      table[stmt.id.name] = stmt;
    } else if (t.isExportNamedDeclaration(stmt) && stmt.declaration) {
      if (t.isTSInterfaceDeclaration(stmt.declaration)) {
        table[stmt.declaration.id.name] = stmt.declaration;
      } else if (
        t.isTSTypeAliasDeclaration(stmt.declaration) &&
        t.isTSTypeLiteral(stmt.declaration.typeAnnotation)
      ) {
        table[stmt.declaration.id.name] = stmt.declaration.typeAnnotation;
      }
    } else if (
      t.isTSTypeAliasDeclaration(stmt) &&
      t.isTSTypeLiteral(stmt.typeAnnotation)
    ) {
      table[stmt.id.name] = stmt.typeAnnotation;
    }
  }
  return table;
}

export function lowerComponent(
  fn: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression,
  name: string,
  filename: string,
  interfaces: InterfaceTable,
  id: string,
): LoweredComponent | undefined {
  const params = extractParams(fn.params, interfaces);
  const body = extractReturnedJsx(fn);
  if (!body) return undefined;

  const componentBody: IRNode = jsxElementToIR(body, filename);

  const source: SourceLoc = {
    file: filename,
    line: fn.loc?.start.line ?? 0,
    col: fn.loc?.start.column ?? 0,
  };

  return {
    component: {
      kind: 'component',
      id,
      name,
      source,
      params,
      body: componentBody,
    },
    diagnostics: [],
  };
}

function extractReturnedJsx(
  fn: t.FunctionDeclaration | t.ArrowFunctionExpression | t.FunctionExpression,
): t.JSXElement | undefined {
  const body = fn.body;
  if (t.isJSXElement(body)) return body;
  if (t.isBlockStatement(body)) {
    for (const stmt of body.body) {
      if (t.isReturnStatement(stmt) && stmt.argument) {
        if (t.isJSXElement(stmt.argument)) return stmt.argument;
        if (
          t.isParenthesizedExpression(stmt.argument) &&
          t.isJSXElement(stmt.argument.expression)
        ) {
          return stmt.argument.expression;
        }
      }
    }
  }
  return undefined;
}

function extractParams(
  params: Array<
    | t.Identifier
    | t.Pattern
    | t.RestElement
    | t.TSParameterProperty
  >,
  interfaces: InterfaceTable,
): IRComponentParam[] {
  if (params.length === 0) return [];
  const first = params[0]!;
  if (t.isTSParameterProperty(first) || t.isRestElement(first)) return [];

  // Resolve the type annotation against the interface table.
  let typeMembers: t.TSTypeElement[] = [];
  const ann = (first as t.Identifier | t.ObjectPattern | t.ArrayPattern | t.AssignmentPattern)
    .typeAnnotation;
  if (ann && t.isTSTypeAnnotation(ann)) {
    const type = ann.typeAnnotation;
    if (t.isTSTypeReference(type) && t.isIdentifier(type.typeName)) {
      const decl = interfaces[type.typeName.name];
      if (decl) {
        typeMembers = t.isTSInterfaceDeclaration(decl)
          ? decl.body.body
          : decl.members;
      }
    } else if (t.isTSTypeLiteral(type)) {
      typeMembers = type.members;
    }
  }

  if (typeMembers.length === 0 && t.isObjectPattern(first)) {
    return objectPatternFallback(first);
  }

  return typeMembers
    .filter((m): m is t.TSPropertySignature => t.isTSPropertySignature(m))
    .map((m) => {
      const key = t.isIdentifier(m.key)
        ? m.key.name
        : t.isStringLiteral(m.key)
          ? m.key.value
          : 'unknown';
      const param: IRComponentParam = {
        name: key,
        type: tsTypeToIRType(m.typeAnnotation?.typeAnnotation),
      };
      if (m.optional === true) param.optional = true;
      return param;
    });
}

function objectPatternFallback(pat: t.ObjectPattern): IRComponentParam[] {
  const out: IRComponentParam[] = [];
  for (const p of pat.properties) {
    if (!t.isObjectProperty(p)) continue;
    if (!t.isIdentifier(p.key)) continue;
    out.push({ name: p.key.name, type: { kind: 'unknown' } });
  }
  return out;
}

function tsTypeToIRType(node: t.TSType | undefined): IRType {
  if (!node) return { kind: 'unknown' };
  if (t.isTSStringKeyword(node)) return { kind: 'string' };
  if (t.isTSNumberKeyword(node)) return { kind: 'number' };
  if (t.isTSBooleanKeyword(node)) return { kind: 'boolean' };
  if (t.isTSFunctionType(node)) return { kind: 'callback' };
  if (t.isTSArrayType(node)) {
    return { kind: 'array', of: tsTypeToIRType(node.elementType) };
  }
  if (t.isTSUnionType(node)) {
    return { kind: 'union', of: node.types.map(tsTypeToIRType) };
  }
  if (t.isTSLiteralType(node) && t.isStringLiteral(node.literal)) {
    return { kind: 'string' };
  }
  return { kind: 'unknown' };
}
