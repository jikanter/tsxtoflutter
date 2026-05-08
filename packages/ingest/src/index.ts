import { createHash } from 'node:crypto';
import type { IRProgram, IRComponent, IRDiagnostic } from '@tsxtoflutter/ir';

export const RULESET_VERSION = '0.1.0';

export interface InputFile {
  path: string;
  contents: string;
  /** 'tsx' | 'mdx' (auto-detected from extension when omitted). */
  kind?: 'tsx' | 'mdx';
}

export interface IngestOptions {
  /** Resolved Tailwind config (theme, screens, plugins). */
  tailwindConfig?: unknown;
  /** Hand-curated map: shadcn component name → semantic tag + variant tokens. */
  shadcnMap?: Record<string, unknown>;
  /** Path to lucide-react → flutter icon name table. */
  lucideMap?: Record<string, string>;
}

/**
 * Parse a set of TSX/MDX inputs and lower them to the shared IR.
 *
 * Implementation lives in `parsers/`, `visitors/`, `styles/`, `components/`.
 * See `research/01-react-ingestion.md` for the algorithm.
 */
export async function ingest(
  inputs: InputFile[],
  _options: IngestOptions = {},
): Promise<IRProgram> {
  const components: IRComponent[] = [];
  const diagnostics: IRDiagnostic[] = [];

  for (const _input of inputs) {
    // TODO: dispatch to parsers/tsx.ts or parsers/mdx.ts based on `kind`.
    // TODO: walk JSX → IR via visitors/.
    // TODO: collapse Tailwind/inline/CSS-modules → NormalizedStyle.
  }

  return {
    version: '0.1',
    inputHash: hashInputs(inputs),
    rulesetVersion: RULESET_VERSION,
    components,
    diagnostics,
  };
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
