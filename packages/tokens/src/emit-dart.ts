import type { DtcgGroup, DtcgToken } from './dtcg.js';

export interface DartThemeOutput {
  /** Path to write the generated theme file to. */
  filePath: string;
  /** Generated Dart source. */
  contents: string;
}

function isToken(node: unknown): node is DtcgToken {
  return (
    typeof node === 'object' &&
    node !== null &&
    Object.prototype.hasOwnProperty.call(node, '$value')
  );
}

function flattenLeaves(group: DtcgGroup, prefix: string[] = []): Array<{ path: string[]; token: DtcgToken }> {
  const out: Array<{ path: string[]; token: DtcgToken }> = [];
  for (const [key, child] of Object.entries(group)) {
    const here = [...prefix, key];
    if (isToken(child)) out.push({ path: here, token: child });
    else if (typeof child === 'object' && child !== null) {
      out.push(...flattenLeaves(child as DtcgGroup, here));
    }
  }
  return out;
}

/** Normalize a hex color (`#rgb`, `#rrggbb`, `#rrggbbaa`) to a Dart `Color(0xAARRGGBB)` literal. */
function hexToDartColor(hex: string): string {
  const raw = hex.startsWith('#') ? hex.slice(1) : hex;
  let r: string, g: string, b: string, a = 'FF';
  if (raw.length === 3) {
    const [r0, g0, b0] = [raw.charAt(0), raw.charAt(1), raw.charAt(2)];
    r = r0 + r0;
    g = g0 + g0;
    b = b0 + b0;
  } else if (raw.length === 6) {
    r = raw.slice(0, 2);
    g = raw.slice(2, 4);
    b = raw.slice(4, 6);
  } else if (raw.length === 8) {
    r = raw.slice(0, 2);
    g = raw.slice(2, 4);
    b = raw.slice(4, 6);
    a = raw.slice(6, 8);
  } else {
    throw new Error(`Cannot parse color "${hex}" — expected #rgb, #rrggbb, or #rrggbbaa`);
  }
  return `Color(0x${a.toUpperCase()}${r.toUpperCase()}${g.toUpperCase()}${b.toUpperCase()})`;
}

function dimensionToDouble(raw: string): string {
  const m = raw.match(/^(-?\d+(?:\.\d+)?)(px|rem)?$/);
  if (!m) throw new Error(`Cannot parse dimension "${raw}"`);
  const n = Number(m[1]!);
  const unit = m[2] ?? 'px';
  const px = unit === 'rem' ? n * 16 : n;
  return `${px.toFixed(1)}`;
}

function dartIdent(path: string[], prefix = ''): string {
  const joined = path.join('_').replace(/[^A-Za-z0-9_]/g, '_');
  return `${prefix}${joined}`;
}

export function emitDartTheme(tokens: DtcgGroup, filePath: string): DartThemeOutput {
  const colorLines: string[] = [];
  const dimLines: string[] = [];

  const colorRoot = tokens['color'];
  if (colorRoot && !isToken(colorRoot)) {
    for (const { path, token } of flattenLeaves(colorRoot as DtcgGroup)) {
      const value = String(token.$value);
      colorLines.push(`  static const Color ${dartIdent(path)} = ${hexToDartColor(value)};`);
    }
  }

  const spacingRoot = tokens['spacing'];
  if (spacingRoot && !isToken(spacingRoot)) {
    for (const { path, token } of flattenLeaves(spacingRoot as DtcgGroup)) {
      const value = String(token.$value);
      dimLines.push(`  static const double ${dartIdent(path, 's')} = ${dimensionToDouble(value)};`);
    }
  }

  const radiusRoot = tokens['radius'] ?? tokens['borderRadius'];
  if (radiusRoot && !isToken(radiusRoot)) {
    for (const { path, token } of flattenLeaves(radiusRoot as DtcgGroup)) {
      const value = String(token.$value);
      dimLines.push(`  static const double ${dartIdent(path, 'r_')} = ${dimensionToDouble(value)};`);
    }
  }

  const contents = `// GENERATED CODE - DO NOT MODIFY BY HAND
// Source: tokens.json (DTCG v1) emitted by @tsxtoflutter/tokens.
import 'package:flutter/material.dart';

abstract final class GeneratedTokens {
${[...colorLines, ...dimLines].join('\n')}
}
`;

  return { filePath, contents };
}
