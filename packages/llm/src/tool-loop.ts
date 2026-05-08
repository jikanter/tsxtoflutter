import type {
  ContentBlock,
  CreateMessageRequest,
  LlmClient,
  Message,
  MessageResponse,
  SystemBlock,
  TextBlock,
  ToolDescriptor,
  ToolResultBlock,
  ToolUseBlock,
} from './client.js';
import { BudgetTracker } from './budget.js';

export type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

export interface ToolLoopOptions {
  client: LlmClient;
  model: string;
  system: SystemBlock[];
  tools: ToolDescriptor[];
  /** Initial user message (the IR subtree + framing). */
  userMessage: string;
  /** Map of tool name -> handler. Names must match `tools[].name`. */
  handlers: Record<string, ToolHandler>;
  budget: BudgetTracker;
  maxTurns?: number;
  /** Callback invoked after every assistant response, for tracing (R5). */
  onTurn?: (turn: ToolLoopTurn) => void;
}

export interface ToolLoopTurn {
  index: number;
  response: MessageResponse;
  toolCalls: ToolUseBlock[];
  toolResults: ToolResultBlock[];
}

export interface ToolLoopResult {
  /** Concatenation of all `text` blocks from the final assistant turn. */
  finalText: string;
  /** Full transcript including tool calls + results. */
  turns: ToolLoopTurn[];
  /** Stop reason from the last response. */
  stopReason: MessageResponse['stop_reason'];
}

export const DEFAULT_MAX_TURNS = 8;

/**
 * Drive a tool-use loop until the model returns `end_turn` or we hit the turn
 * cap. Every turn updates the budget tracker; budget overruns throw and the
 * caller should mark the conversion `failed`.
 */
export async function runToolLoop(opts: ToolLoopOptions): Promise<ToolLoopResult> {
  const maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS;
  const messages: Message[] = [
    { role: 'user', content: [{ type: 'text', text: opts.userMessage } satisfies TextBlock] },
  ];
  const turns: ToolLoopTurn[] = [];

  for (let i = 0; i < maxTurns; i++) {
    const req: CreateMessageRequest = {
      model: opts.model,
      max_tokens: 4096,
      system: opts.system,
      messages,
      tools: opts.tools,
    };
    const response = await opts.client.createMessage(req);
    opts.budget.recordUsage({
      model: opts.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      ...(response.usage.cache_read_input_tokens !== undefined
        ? { cacheReadInputTokens: response.usage.cache_read_input_tokens }
        : {}),
      ...(response.usage.cache_creation_input_tokens !== undefined
        ? { cacheCreationInputTokens: response.usage.cache_creation_input_tokens }
        : {}),
    });

    const toolCalls = response.content.filter(
      (c): c is ToolUseBlock => c.type === 'tool_use',
    );
    let toolResults: ToolResultBlock[] = [];

    if (toolCalls.length > 0) {
      messages.push({ role: 'assistant', content: response.content });
      toolResults = await Promise.all(
        toolCalls.map((call) => runOneTool(call, opts.handlers)),
      );
      // Each tool round counts as a turn against the budget.
      opts.budget.recordToolTurn();
      messages.push({
        role: 'user',
        content: toolResults satisfies ContentBlock[],
      });
    }

    const turn: ToolLoopTurn = { index: i, response, toolCalls, toolResults };
    turns.push(turn);
    opts.onTurn?.(turn);

    if (response.stop_reason !== 'tool_use') {
      return {
        finalText: extractText(response.content),
        turns,
        stopReason: response.stop_reason,
      };
    }
  }

  // Max turns hit without an `end_turn`. Surface this as a budget-style failure.
  const last = turns[turns.length - 1];
  return {
    finalText: last ? extractText(last.response.content) : '',
    turns,
    stopReason: 'max_tokens',
  };
}

async function runOneTool(
  call: ToolUseBlock,
  handlers: Record<string, ToolHandler>,
): Promise<ToolResultBlock> {
  const handler = handlers[call.name];
  if (!handler) {
    return {
      type: 'tool_result',
      tool_use_id: call.id,
      is_error: true,
      content: `Unknown tool: ${call.name}`,
    };
  }
  try {
    const result = await handler(call.input);
    return {
      type: 'tool_result',
      tool_use_id: call.id,
      content: typeof result === 'string' ? result : JSON.stringify(result),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      type: 'tool_result',
      tool_use_id: call.id,
      is_error: true,
      content: message,
    };
  }
}

function extractText(content: ContentBlock[]): string {
  return content
    .filter((c): c is TextBlock => c.type === 'text')
    .map((t) => t.text)
    .join('\n');
}
