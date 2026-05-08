import type { SystemBlock, ToolDescriptor } from './client.js';

/**
 * The system prompt is intentionally static + large: rules + closed widget
 * catalog + token map. It is anchored by a single `cache_control` breakpoint
 * at the end so every request hits the prompt cache.
 *
 * Phase-3 invariants:
 *   - exactly one ephemeral breakpoint, on the LAST block
 *   - no per-conversion data in the system message (those go into messages[])
 *   - Sonnet-first: catalog framing names Sonnet, Opus is mentioned only as escalation
 */

export interface BuildSystemPromptOptions {
  /** Closed widget catalog the model is allowed to emit. */
  widgetCatalog: WidgetCatalogEntry[];
  /** Token paths the model may reference (from tokens.json). */
  tokenPaths: string[];
  /** Model tier name surfaced in the prompt for routing-aware framing. */
  tier: 'sonnet' | 'opus' | 'haiku';
  /** Cache TTL; '5m' for hot path, '1h' for nightly batch. */
  ttl?: '5m' | '1h';
}

export interface WidgetCatalogEntry {
  /** Flutter widget name, e.g. `FilledButton`. */
  name: string;
  /** One-line summary used to ground the model. */
  summary: string;
  /** Adaptive shim if relevant, e.g. `AppButton`. */
  adaptive?: string;
}

const RULES = `# Rules

You are the LLM-fallback path of the tsxtoflutter pipeline. Your only job is to
translate IR subtrees the deterministic codemod could not lower into idiomatic
Flutter Dart.

Hard constraints:
- Output Dart that compiles for iOS, Android, and Web.
- Use only widgets in the catalog below. Unknown widget => the conversion fails.
- Resolve every color, spacing, and font through the token map. No literal hex.
- Do not emit \`Platform.isIOS ? ... : ...\`. Use the \`App*\` adaptive shims.
- When uncertain, call a tool. Never guess.
`;

const TOOL_PROTOCOL = `# Tool protocol

When you need information you don't have, call a tool. The harness binds these:

- run_flutter_analyze(dart_source)  — returns analyzer errors/warnings.
- render_widget_screenshot(dart_source) — returns a base64 PNG screenshot.
- get_design_token(name) — resolves a token path to its concrete value.
- lookup_widget_catalog(query) — searches the closed widget catalog.

Tool calls subtract from a per-conversion budget. If you exceed MAX_TURNS=8,
the harness terminates the conversion. Do not retry blindly; reason first.
`;

function tierFraming(tier: BuildSystemPromptOptions['tier']): string {
  switch (tier) {
    case 'sonnet':
      return '# Tier: Sonnet (hot path).\n\nYou are the default route. Aim for first-shot correctness on familiar shapes; escalate only when truly novel.';
    case 'opus':
      return '# Tier: Opus (escalation).\n\nYou were called because two Sonnet attempts failed or the subtree was flagged novel. Take more reasoning steps; cite catalog entries by name.';
    case 'haiku':
      return '# Tier: Haiku (classification + naming).\n\nYou handle classification or renaming jobs only; do not emit full widget trees on this tier.';
  }
}

export function buildSystemPrompt(opts: BuildSystemPromptOptions): SystemBlock[] {
  const blocks: SystemBlock[] = [];

  blocks.push({ type: 'text', text: RULES });
  blocks.push({ type: 'text', text: tierFraming(opts.tier) });
  blocks.push({ type: 'text', text: TOOL_PROTOCOL });
  blocks.push({ type: 'text', text: formatCatalog(opts.widgetCatalog) });

  // Last block carries the cache breakpoint. Token list goes here so it is the
  // tail of the cached prefix.
  const last: SystemBlock = {
    type: 'text',
    text: formatTokenMap(opts.tokenPaths),
    cache_control: { type: 'ephemeral', ttl: opts.ttl ?? '5m' },
  };
  blocks.push(last);

  return blocks;
}

function formatCatalog(entries: WidgetCatalogEntry[]): string {
  const lines = ['# Widget catalog (closed)'];
  for (const e of entries) {
    const adaptive = e.adaptive ? ` [adaptive: ${e.adaptive}]` : '';
    lines.push(`- ${e.name}${adaptive} — ${e.summary}`);
  }
  return lines.join('\n');
}

function formatTokenMap(paths: string[]): string {
  const lines = ['# Token map (paths usable in $token references)'];
  for (const p of paths) lines.push(`- ${p}`);
  return lines.join('\n');
}

/**
 * Asserts the system blocks have exactly one cache breakpoint, and that it
 * sits on the last block. Used by tests and the LLM-loop preflight to keep
 * the cache hit-rate target (≥80%) achievable.
 */
export function assertSingleCacheBreakpoint(system: SystemBlock[]): void {
  const breakpoints = system.filter((b) => b.cache_control !== undefined);
  if (breakpoints.length !== 1) {
    throw new Error(
      `system prompt must have exactly 1 cache_control breakpoint; found ${breakpoints.length}`,
    );
  }
  const last = system[system.length - 1];
  if (!last || last.cache_control === undefined) {
    throw new Error('cache_control breakpoint must sit on the LAST system block');
  }
}

/** Default widget catalog used when callers don't pass one. Conservative; grow as the runtime grows. */
export const DEFAULT_WIDGET_CATALOG: readonly WidgetCatalogEntry[] = [
  { name: 'Text', summary: 'Plain text node.' },
  { name: 'Row', summary: 'Horizontal flex; use spacing param for gaps.' },
  { name: 'Column', summary: 'Vertical flex; use spacing param for gaps.' },
  { name: 'Padding', summary: 'EdgeInsets wrapper around a child.' },
  { name: 'Container', summary: 'Box decoration / sizing wrapper.' },
  { name: 'SizedBox', summary: 'Fixed-size box; commonly for spacing.' },
  { name: 'Icon', summary: 'Material icon glyph; resolves Lucide names via lucide-map.' },
  { name: 'FilledButton', summary: 'Primary M3 action button.', adaptive: 'AppButton' },
  { name: 'TextButton', summary: 'Low-emphasis text action.', adaptive: 'AppButton' },
  { name: 'OutlinedButton', summary: 'Mid-emphasis bordered action.', adaptive: 'AppButton' },
  { name: 'Switch', summary: 'M3 toggle.', adaptive: 'AppSwitch' },
  { name: 'Card', summary: 'M3 elevated/filled/outlined card.' },
  { name: 'Scaffold', summary: 'Page-level chrome.', adaptive: 'AppScaffold' },
  { name: 'AppBar', summary: 'Top-of-page chrome.', adaptive: 'AppNavBar' },
  { name: 'ListTile', summary: 'Single row in a list with leading/trailing.', adaptive: 'AppListTile' },
  { name: 'AlertDialog', summary: 'Modal confirmation.', adaptive: 'AppDialog' },
];

/** Default tool descriptors for the self-correction loop (R3). */
export const DEFAULT_TOOLS: readonly ToolDescriptor[] = [
  {
    name: 'run_flutter_analyze',
    description: 'Run flutter analyze on a Dart snippet in a sandboxed temp project. Returns errors and warnings.',
    input_schema: {
      type: 'object',
      properties: {
        dart_source: { type: 'string', description: 'Full Dart source for the widget under test.' },
      },
      required: ['dart_source'],
    },
  },
  {
    name: 'render_widget_screenshot',
    description: 'Boot a headless Flutter Web instance and capture a PNG screenshot of the rendered widget.',
    input_schema: {
      type: 'object',
      properties: {
        dart_source: { type: 'string', description: 'Full Dart source for the widget under test.' },
      },
      required: ['dart_source'],
    },
  },
  {
    name: 'get_design_token',
    description: 'Resolve a token path against the project tokens.json.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Dot-separated token path, e.g. "color.brand.500".' },
      },
      required: ['name'],
    },
  },
  {
    name: 'lookup_widget_catalog',
    description: 'Search the closed widget catalog for widgets matching a query.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Plain English description of the widget you want.' },
      },
      required: ['query'],
    },
  },
];
