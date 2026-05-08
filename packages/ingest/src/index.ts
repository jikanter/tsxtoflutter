import { createHash } from 'node:crypto';
import * as t from '@babel/types';
import type {
  IRComponent,
  IRDiagnostic,
  IRProgram,
} from '@tsxtoflutter/ir';
import { IRProgramSchema } from '@tsxtoflutter/ir';

import { parseTsx } from './parsers/tsx.js';
import { collectInterfaces, lowerComponent } from './lower/component.js';

export { decide, localComplexity } from './translate/decide.js';
export type { EscalationPolicyResult, DecideOptions } from './translate/decide.js';
export { lowerWithLlm } from './translate/llm-fallback.js';
export type { LlmFallbackInput, LlmFallbackOutput } from './translate/llm-fallback.js';

// Phase 4 R4: MDX-frontmatter `permissions:` → Info.plist privacy strings.
// Standalone emitter — wired in once MDX ingestion lands.
export {
  emitInfoPlistPrivacyStrings,
  PRIVACY_KEY_BY_PERMISSION,
} from './mdx/privacy.js';
export type {
  PermissionKey,
  PrivacyEmitResult,
} from './mdx/privacy.js';

export const RULESET_VERSION = '0.1.0';

export interface InputFile {
  path: string;
  contents: string;
  /** 'tsx' | 'mdx' (auto-detected from extension when omitted). */
  kind?: 'tsx' | 'mdx';
}

export interface IngestOptions {
  tailwindConfig?: unknown;
  shadcnMap?: Record<string, unknown>;
  lucideMap?: Record<string, string>;
  /** When true, validate the resulting IR against the zod schema. Default true. */
  validate?: boolean;
}

export async function ingest(
  inputs: InputFile[],
  options: IngestOptions = {},
): Promise<IRProgram> {
  const components: IRComponent[] = [];
  const diagnostics: IRDiagnostic[] = [];

  for (const input of inputs) {
    const kind = input.kind ?? detectKind(input.path);
    if (kind === 'mdx') {
      diagnostics.push({
        severity: 'warn',
        code: 'mdx-not-supported',
        message: 'MDX ingestion lands in a later phase; skipping.',
      });
      continue;
    }
    const parsed = parseTsx(input.contents, input.path);
    const interfaces = collectInterfaces(parsed.ast);
    const contentHash = sha256(input.contents);

    for (const stmt of parsed.ast.program.body) {
      const decl = unwrapExport(stmt);
      if (!decl) continue;

      if (t.isFunctionDeclaration(decl) && decl.id) {
        const name = decl.id.name;
        const id = stableId(input.path, name, contentHash);
        const lowered = lowerComponent(decl, name, input.path, interfaces, id);
        if (lowered) {
          components.push(lowered.component);
          diagnostics.push(...lowered.diagnostics);
        }
        continue;
      }

      if (t.isVariableDeclaration(decl)) {
        for (const v of decl.declarations) {
          if (
            t.isIdentifier(v.id) &&
            v.init &&
            (t.isArrowFunctionExpression(v.init) ||
              t.isFunctionExpression(v.init))
          ) {
            const name = v.id.name;
            const id = stableId(input.path, name, contentHash);
            const lowered = lowerComponent(
              v.init,
              name,
              input.path,
              interfaces,
              id,
            );
            if (lowered) {
              components.push(lowered.component);
              diagnostics.push(...lowered.diagnostics);
            }
          }
        }
      }
    }
  }

  const program: IRProgram = {
    version: '0.1',
    inputHash: hashInputs(inputs),
    rulesetVersion: RULESET_VERSION,
    components,
    diagnostics,
  };

  if (options.validate !== false) {
    const result = IRProgramSchema.safeParse(program);
    if (!result.success) {
      throw new Error(
        `IR failed schema validation: ${result.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
  }

  return program;
}

function unwrapExport(
  stmt: t.Statement,
): t.FunctionDeclaration | t.VariableDeclaration | undefined {
  if (t.isExportNamedDeclaration(stmt) && stmt.declaration) {
    if (t.isFunctionDeclaration(stmt.declaration)) return stmt.declaration;
    if (t.isVariableDeclaration(stmt.declaration)) return stmt.declaration;
  }
  if (t.isFunctionDeclaration(stmt)) return stmt;
  if (t.isVariableDeclaration(stmt)) return stmt;
  return undefined;
}

function detectKind(path: string): 'tsx' | 'mdx' {
  return path.toLowerCase().endsWith('.mdx') ? 'mdx' : 'tsx';
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function stableId(
  path: string,
  exportName: string,
  contentHash: string,
): string {
  return sha256(path + exportName + contentHash);
}

function hashInputs(inputs: InputFile[]): string {
  const h = createHash('sha256');
  for (const i of inputs) {
    h.update(i.path);
    h.update('\0');
    h.update(i.contents);
    h.update('\0');
  }
  return h.digest('hex');
}

