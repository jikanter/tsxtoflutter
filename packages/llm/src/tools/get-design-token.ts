import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface ResolvedToken {
  /** Concrete value, e.g. '#3B82F6' or 16. */
  value: string | number;
  /** DTCG `$type`, e.g. 'color' | 'dimension' | 'fontFamily' | 'number'. */
  type: string;
}

export interface GetDesignTokenOptions {
  /** Override the tokens.json path; defaults to <cwd>/tokens.json. */
  tokensPath?: string;
  /** Pre-loaded resolved DTCG tree (test injection). */
  resolved?: Record<string, unknown>;
}

/**
 * Resolve a dot-path against the project tokens.json, returning the concrete
 * `$value` + `$type`. Aliases are assumed already resolved upstream by
 * `@tsxtoflutter/tokens` so this lookup is pure.
 */
export async function getDesignToken(
  name: string,
  opts: GetDesignTokenOptions = {},
): Promise<ResolvedToken> {
  const root = opts.resolved ?? (await loadTokensFile(opts.tokensPath));
  const node = walk(root, name.split('.'));
  if (!node || typeof node !== 'object') {
    throw new Error(`Token not found: ${name}`);
  }
  const obj = node as Record<string, unknown>;
  if (!('$value' in obj)) throw new Error(`Token "${name}" is a group, not a leaf.`);
  const value = obj['$value'];
  const type = typeof obj['$type'] === 'string' ? (obj['$type'] as string) : 'unknown';
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`Token "${name}" has unsupported $value shape; expected string|number.`);
  }
  return { value, type };
}

async function loadTokensFile(p?: string): Promise<Record<string, unknown>> {
  const fp = p ?? path.join(process.cwd(), 'tokens.json');
  const raw = await fs.readFile(fp, 'utf8');
  const parsed = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`tokens.json at ${fp} is not an object`);
  }
  return parsed as Record<string, unknown>;
}

function walk(root: Record<string, unknown>, segments: string[]): unknown {
  let cur: unknown = root;
  for (const seg of segments) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[seg];
    if (cur === undefined) return undefined;
  }
  return cur;
}
