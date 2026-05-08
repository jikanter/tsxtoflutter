/**
 * DTCG (W3C Design Tokens v1) loader and alias resolver.
 *
 * One `tokens.json` (`application/design-tokens+json`) drives both the
 * Tailwind config emitter (`emit-tailwind.ts`) and the Dart theme emitter
 * (`emit-dart.ts`). This module owns the parse + alias-resolution stage; the
 * emitters consume the resolved tree.
 */

import { promises as fs } from 'node:fs';

export interface DtcgToken {
  $value: string | number | Record<string, unknown>;
  $type?: string;
  $description?: string;
}

export interface DtcgGroup {
  [key: string]: DtcgToken | DtcgGroup;
}

export class DtcgCycleError extends Error {
  constructor(public readonly cyclePath: string[]) {
    super(`DTCG alias cycle detected: ${cyclePath.join(' -> ')}`);
    this.name = 'DtcgCycleError';
  }
}

const ALIAS_RE = /^\{([^}]+)\}$/;

function isToken(node: unknown): node is DtcgToken {
  return (
    typeof node === 'object' &&
    node !== null &&
    Object.prototype.hasOwnProperty.call(node, '$value')
  );
}

function isGroup(node: unknown): node is DtcgGroup {
  return typeof node === 'object' && node !== null && !isToken(node);
}

export function parseDtcg(input: unknown): DtcgGroup {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('DTCG root must be a plain object');
  }
  return input as DtcgGroup;
}

export async function loadDtcg(filePath: string): Promise<DtcgGroup> {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return resolveAliases(parseDtcg(parsed));
}

function getByPath(root: DtcgGroup, path: string[]): DtcgToken | DtcgGroup | undefined {
  let cur: DtcgToken | DtcgGroup | undefined = root;
  for (const key of path) {
    if (!cur || isToken(cur)) return undefined;
    cur = (cur as DtcgGroup)[key];
  }
  return cur;
}

export function resolveAliases(root: DtcgGroup): DtcgGroup {
  const out: DtcgGroup = {};

  const resolve = (
    value: DtcgToken['$value'],
    pathHere: string[],
    visiting: Set<string>,
    chain: string[],
  ): DtcgToken['$value'] => {
    if (typeof value !== 'string') return value;
    const m = value.match(ALIAS_RE);
    if (!m) return value;

    const targetPath = m[1]!.split('.');
    const targetKey = targetPath.join('.');
    const fromKey = pathHere.join('.');

    if (visiting.has(targetKey)) {
      throw new DtcgCycleError([...chain, targetKey]);
    }

    const resolved = getByPath(root, targetPath);
    if (resolved === undefined) {
      throw new Error(
        `DTCG alias "{${targetKey}}" referenced from "${fromKey}" does not resolve`,
      );
    }
    if (!isToken(resolved)) {
      throw new Error(
        `DTCG alias "{${targetKey}}" referenced from "${fromKey}" points at a group, not a token`,
      );
    }

    visiting.add(targetKey);
    chain.push(targetKey);
    try {
      return resolve(resolved.$value, targetPath, visiting, chain);
    } finally {
      visiting.delete(targetKey);
      chain.pop();
    }
  };

  const walk = (group: DtcgGroup, into: DtcgGroup, prefix: string[]) => {
    for (const [key, child] of Object.entries(group)) {
      const here = [...prefix, key];
      if (isToken(child)) {
        const visiting = new Set<string>([here.join('.')]);
        const chain = [here.join('.')];
        const next: DtcgToken = { ...child };
        next.$value = resolve(child.$value, here, visiting, chain);
        into[key] = next;
      } else if (isGroup(child)) {
        const sub: DtcgGroup = {};
        into[key] = sub;
        walk(child, sub, here);
      }
    }
  };

  walk(root, out, []);
  return out;
}

export type { TailwindThemeOutput } from './emit-tailwind.js';
export type { DartThemeOutput } from './emit-dart.js';
export { emitTailwindTheme } from './emit-tailwind.js';
export { emitDartTheme } from './emit-dart.js';
