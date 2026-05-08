/**
 * Wires `decide()` to the actual LLM tool-use loop in `@tsxtoflutter/llm`.
 *
 * Kept in `packages/ingest` because the ingest pipeline owns the IR-side
 * decision; the llm package owns transport. The function below is the
 * single entry point ingest calls when escalation is triggered.
 */

import type { IRComponent } from '@tsxtoflutter/ir';
import {
  BudgetTracker,
  buildSystemPrompt,
  DEFAULT_TOOLS,
  DEFAULT_WIDGET_CATALOG,
  MODELS,
  runToolLoop,
  type LlmClient,
  type ToolHandler,
  type ToolLoopResult,
} from '@tsxtoflutter/llm';

export interface LlmFallbackInput {
  client: LlmClient;
  component: IRComponent;
  /** Token paths exposed to the model via the system prompt. */
  tokenPaths: string[];
  /** Tool implementations the model can call. */
  handlers: Record<string, ToolHandler>;
  /** Pre-existing tracker so usage rolls up across multiple subtrees. */
  budget?: BudgetTracker;
  /** Tier flag — Sonnet is the only tier on by default in Phase 3. */
  tier?: 'sonnet' | 'opus' | 'haiku';
  /** Cache TTL; '5m' for hot path, '1h' for nightly batch. */
  cacheTtl?: '5m' | '1h';
}

export interface LlmFallbackOutput {
  dartSource: string;
  loop: ToolLoopResult;
  budget: BudgetTracker;
}

export async function lowerWithLlm(input: LlmFallbackInput): Promise<LlmFallbackOutput> {
  const tier = input.tier ?? 'sonnet';
  const budget = input.budget ?? new BudgetTracker();
  const ttl = input.cacheTtl ?? '5m';
  const system = buildSystemPrompt({
    widgetCatalog: [...DEFAULT_WIDGET_CATALOG],
    tokenPaths: input.tokenPaths,
    tier,
    ttl,
  });

  const userMessage = renderUserMessage(input.component);
  const loop = await runToolLoop({
    client: input.client,
    model: pickModel(tier),
    system,
    tools: [...DEFAULT_TOOLS],
    userMessage,
    handlers: input.handlers,
    budget,
  });

  return { dartSource: loop.finalText, loop, budget };
}

function pickModel(tier: 'sonnet' | 'opus' | 'haiku'): string {
  return MODELS[tier];
}

function renderUserMessage(component: IRComponent): string {
  return [
    `Lower the following IR component to idiomatic Flutter Dart.`,
    `Component name: ${component.name}`,
    `Stable ID: ${component.id}`,
    '',
    'Constraints:',
    '- Use only widgets in the catalog.',
    '- Resolve every color/spacing through the token map.',
    '- Adaptive shims (App*) must be used for platform-sensitive widgets.',
    '',
    'IR (JSON):',
    '```json',
    JSON.stringify(component, null, 2),
    '```',
  ].join('\n');
}
