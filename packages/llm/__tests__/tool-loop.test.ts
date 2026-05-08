import { describe, expect, it } from 'vitest';
import {
  BudgetExceededError,
  BudgetTracker,
  DEFAULT_TOOLS,
  DEFAULT_WIDGET_CATALOG,
  buildSystemPrompt,
  runToolLoop,
  type CreateMessageRequest,
  type LlmClient,
  type MessageResponse,
  type ToolHandler,
} from '../src/index.js';

class FakeClient implements LlmClient {
  public requests: CreateMessageRequest[] = [];
  constructor(private readonly responses: MessageResponse[]) {}
  async createMessage(req: CreateMessageRequest): Promise<MessageResponse> {
    this.requests.push(req);
    const r = this.responses.shift();
    if (!r) throw new Error('FakeClient: no more queued responses');
    return r;
  }
}

function assistantText(text: string, usage = { input_tokens: 100, output_tokens: 20 }): MessageResponse {
  return {
    id: 'msg_text',
    model: 'claude-sonnet-4-6',
    role: 'assistant',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
    usage,
  };
}

function assistantToolUse(name: string, input: Record<string, unknown>): MessageResponse {
  return {
    id: 'msg_tool',
    model: 'claude-sonnet-4-6',
    role: 'assistant',
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: 'tu_1', name, input }],
    usage: { input_tokens: 50, output_tokens: 10 },
  };
}

const baseOpts = {
  model: 'claude-sonnet-4-6',
  system: buildSystemPrompt({
    widgetCatalog: [...DEFAULT_WIDGET_CATALOG],
    tokenPaths: [],
    tier: 'sonnet' as const,
  }),
  tools: [...DEFAULT_TOOLS],
  userMessage: 'lower this',
};

describe('runToolLoop', () => {
  it('returns end_turn text on a single-turn conversation', async () => {
    const client = new FakeClient([assistantText('// generated dart')]);
    const result = await runToolLoop({
      ...baseOpts,
      client,
      handlers: {},
      budget: new BudgetTracker(),
    });
    expect(result.stopReason).toBe('end_turn');
    expect(result.finalText).toBe('// generated dart');
    expect(result.turns).toHaveLength(1);
  });

  it('routes tool_use, feeds back tool_result, and continues', async () => {
    const client = new FakeClient([
      assistantToolUse('get_design_token', { name: 'color.brand.500' }),
      assistantText('// resolved'),
    ]);
    const handlers: Record<string, ToolHandler> = {
      get_design_token: async () => ({ value: '#3B82F6', type: 'color' }),
    };
    const result = await runToolLoop({
      ...baseOpts,
      client,
      handlers,
      budget: new BudgetTracker(),
    });
    expect(result.turns).toHaveLength(2);
    expect(result.turns[0]?.toolCalls).toHaveLength(1);
    expect(result.turns[0]?.toolResults[0]?.is_error).toBeUndefined();
    expect(result.finalText).toBe('// resolved');
  });

  it('reports a tool error to the model rather than crashing the loop', async () => {
    const client = new FakeClient([
      assistantToolUse('get_design_token', { name: 'missing' }),
      assistantText('handled'),
    ]);
    const handlers: Record<string, ToolHandler> = {
      get_design_token: async () => {
        throw new Error('Token not found: missing');
      },
    };
    const result = await runToolLoop({
      ...baseOpts,
      client,
      handlers,
      budget: new BudgetTracker(),
    });
    expect(result.turns[0]?.toolResults[0]?.is_error).toBe(true);
    expect(String(result.turns[0]?.toolResults[0]?.content)).toContain('not found');
  });

  it('fails closed via BudgetTracker when a runaway tool loop blows the cap', async () => {
    // 3-turn cap; the loop should throw the moment turn 4 is recorded.
    const responses: MessageResponse[] = Array.from({ length: 20 }, () =>
      assistantToolUse('get_design_token', { name: 'x' }),
    );
    const client = new FakeClient(responses);
    const handlers: Record<string, ToolHandler> = {
      get_design_token: async () => ({ value: '#000', type: 'color' }),
    };
    await expect(
      runToolLoop({
        ...baseOpts,
        client,
        handlers,
        budget: new BudgetTracker({ maxToolTurns: 3 }),
      }),
    ).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it('exits via stopReason=max_tokens on natural MAX_TURNS exhaustion', async () => {
    // Same scenario but the budget allows enough turns; the loop's own cap exits.
    const responses: MessageResponse[] = Array.from({ length: 20 }, () =>
      assistantToolUse('get_design_token', { name: 'x' }),
    );
    const client = new FakeClient(responses);
    const handlers: Record<string, ToolHandler> = {
      get_design_token: async () => ({ value: '#000', type: 'color' }),
    };
    const result = await runToolLoop({
      ...baseOpts,
      client,
      handlers,
      budget: new BudgetTracker({ maxToolTurns: 100 }),
      maxTurns: 4,
    });
    expect(result.turns).toHaveLength(4);
    expect(result.stopReason).toBe('max_tokens');
  });
});
