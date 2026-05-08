import type { DtcgGroup, DtcgToken } from './dtcg.js';

export interface TailwindThemeOutput {
  colors: Record<string, string>;
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  fontFamily: Record<string, string[]>;
  fontSize: Record<string, [string, { lineHeight?: string }]>;
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

function asString(value: DtcgToken['$value']): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

export function emitTailwindTheme(tokens: DtcgGroup): TailwindThemeOutput {
  const out: TailwindThemeOutput = {
    colors: {},
    spacing: {},
    borderRadius: {},
    fontFamily: {},
    fontSize: {},
  };

  const groups: Array<[string, keyof TailwindThemeOutput]> = [
    ['color', 'colors'],
    ['spacing', 'spacing'],
    ['radius', 'borderRadius'],
    ['borderRadius', 'borderRadius'],
    ['font-family', 'fontFamily'],
    ['fontFamily', 'fontFamily'],
    ['font-size', 'fontSize'],
    ['fontSize', 'fontSize'],
  ];

  for (const [src, dst] of groups) {
    const root = tokens[src];
    if (!root || isToken(root)) continue;
    const leaves = flattenLeaves(root as DtcgGroup);
    for (const { path, token } of leaves) {
      const key = path.join('.');
      const value = asString(token.$value);
      if (dst === 'fontFamily') {
        out.fontFamily[key] = Array.isArray(token.$value) ? (token.$value as string[]) : value.split(',').map((s) => s.trim());
      } else if (dst === 'fontSize') {
        out.fontSize[key] = [value, {}];
      } else if (dst === 'colors' || dst === 'spacing' || dst === 'borderRadius') {
        out[dst][key] = value;
      }
    }
  }

  return out;
}
