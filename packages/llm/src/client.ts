/**
 * Thin Anthropic Messages API client. We hand-roll the request to avoid
 * pulling in the full SDK while still following the conventions from the
 * `claude-api` skill: prompt caching breakpoints, tool_use loop, model
 * tier names. The interface is the seam — tests inject a fake.
 */

export type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock;

export interface TextBlock {
  type: 'text';
  text: string;
  /** Anthropic prompt-caching breakpoint. We use this on the system prompt. */
  cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' };
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | TextBlock[];
  is_error?: boolean;
}

export type Role = 'user' | 'assistant';

export interface Message {
  role: Role;
  content: ContentBlock[];
}

export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' };
}

export interface ToolDescriptor {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface CreateMessageRequest {
  model: string;
  max_tokens: number;
  /** Static + cacheable. Last block carries the cache breakpoint. */
  system?: SystemBlock[];
  messages: Message[];
  tools?: ToolDescriptor[];
  temperature?: number;
}

export interface MessageUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface MessageResponse {
  id: string;
  model: string;
  role: 'assistant';
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  content: ContentBlock[];
  usage: MessageUsage;
}

export interface LlmClient {
  createMessage(req: CreateMessageRequest): Promise<MessageResponse>;
}

export interface AnthropicClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Anthropic API version pin. */
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}

export class AnthropicLlmClient implements LlmClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AnthropicClientOptions) {
    if (!opts.apiKey) {
      throw new Error(
        'AnthropicLlmClient requires apiKey. Set ANTHROPIC_API_KEY or pass it explicitly; never silently fall back.',
      );
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.anthropic.com';
    this.apiVersion = opts.apiVersion ?? '2023-06-01';
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async createMessage(req: CreateMessageRequest): Promise<MessageResponse> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${text}`);
    }
    return (await res.json()) as MessageResponse;
  }
}

/**
 * Returns the configured client, or throws a descriptive error if the API
 * key is missing. Kept as a separate factory so the CLI can fail-fast at
 * boot rather than mid-conversion.
 */
export function clientFromEnv(env: NodeJS.ProcessEnv = process.env): LlmClient {
  const apiKey = env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Either set it in the environment or run with --no-llm to disable the fallback.',
    );
  }
  return new AnthropicLlmClient({ apiKey });
}
