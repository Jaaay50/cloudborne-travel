import { AiApiError, CLOUDBORNE_BASE_URL, type ModelInfo, type OpenAiMessage, type OpenAiToolCall, type OpenAiToolDef } from './types';

type RequestOptions = { signal?: AbortSignal; fetchImpl?: typeof fetch };
type ChatOptions = RequestOptions & {
  apiKey: string;
  model: string;
  messages: OpenAiMessage[];
  tools?: OpenAiToolDef[];
  temperature?: number;
  onTextDelta?: (chunk: string) => void;
  onToolCallDelta?: (name: string) => void;
};
type Completion = { content: string; toolCalls: OpenAiToolCall[]; finishReason?: string };

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AiApiError('aborted', 'Request aborted');
}

function transportError(error: unknown, signal?: AbortSignal): AiApiError {
  if (signal?.aborted || object(error)?.name === 'AbortError') return new AiApiError('aborted', 'Request aborted');
  return new AiApiError('cors_or_network', 'Unable to reach Cloudborne');
}

function statusCode(status: number): AiApiError['code'] {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'bad_request';
  return 'invalid_response';
}

async function request(path: '/models' | '/chat/completions', apiKey: string, opts: RequestOptions, init: RequestInit): Promise<Response> {
  checkAbort(opts.signal);
  const key = apiKey.trim();
  if (!key) throw new AiApiError('missing_key', 'API key is required');
  let response: Response;
  try {
    response = await (opts.fetchImpl ?? fetch)(CLOUDBORNE_BASE_URL + path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${key}` },
      signal: opts.signal,
      redirect: 'error',
    });
  } catch (error) {
    throw transportError(error, opts.signal);
  }
  checkAbort(opts.signal);
  if (!response.ok) {
    // Error bodies are relay-controlled and can contain credentials or request data.
    throw new AiApiError(statusCode(response.status), `Cloudborne request failed (${response.status})`, response.status);
  }
  return response;
}

async function readJson(response: Response, signal?: AbortSignal): Promise<unknown> {
  try {
    const value: unknown = await response.json();
    checkAbort(signal);
    return value;
  } catch (error) {
    if (signal?.aborted || object(error)?.name === 'AbortError') throw transportError(error, signal);
    if (error instanceof TypeError) throw transportError(error, signal);
    throw new AiApiError('invalid_response', 'Invalid Cloudborne JSON response', response.status);
  }
}

function modelRows(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  const root = object(value);
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.models)) return root.models;
  const wrapped = object(root?.data);
  return Array.isArray(wrapped?.models) ? wrapped.models : undefined;
}

function classifyModel(id: string, row?: Record<string, unknown>): ModelInfo['category'] {
  const kind = row?.category ?? row?.type;
  if (kind === 'other') return 'other';
  if (/(embed|rerank|moderation|whisper|(?:^|[-_/])(?:tts|asr|stt|image|dall-e|sora)(?:[-_/]|$))/i.test(id)) return 'other';
  if (kind === 'chat' || /chat|gpt|claude|deepseek|qwen|kimi|moonshot|llama|gemini|mistral|grok|glm|doubao|hunyuan|ernie|minimax/i.test(id)) return 'chat';
  return 'other';
}

export async function fetchModels(apiKey: string, opts: RequestOptions = {}): Promise<ModelInfo[]> {
  const response = await request('/models', apiKey, opts, { method: 'GET', headers: { Accept: 'application/json' } });
  const rows = modelRows(await readJson(response, opts.signal));
  if (!rows) throw new AiApiError('invalid_response', 'Invalid model list', response.status);
  const models = new Map<string, ModelInfo>();
  for (const value of rows) {
    const row = object(value);
    const rawId = typeof value === 'string' ? value : row?.id;
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id || models.has(id)) continue;
    const ownedBy = row?.owned_by ?? row?.ownedBy;
    const category = classifyModel(id, row);
    const recommended = category === 'chat' && (typeof row?.recommended === 'boolean' ? row.recommended : /gpt|claude|gemini|deepseek|qwen|kimi/i.test(id));
    models.set(id, { id, ...(typeof ownedBy === 'string' ? { ownedBy } : {}), category, recommended });
  }
  return [...models.values()].sort((a, b) =>
    Number(b.recommended) - Number(a.recommended)
    || Number(b.category === 'chat') - Number(a.category === 'chat')
    || a.id.localeCompare(b.id));
}

type PartialCall = { id: string; name: string; arguments: string };
function appendCalls(calls: Map<number, PartialCall>, value: unknown, onName?: ChatOptions['onToolCallDelta']): void {
  if (!Array.isArray(value)) return;
  value.forEach((item, position) => {
    const delta = object(item);
    if (!delta) return;
    const index = typeof delta.index === 'number' && Number.isSafeInteger(delta.index) && delta.index >= 0 ? delta.index : position;
    const call = calls.get(index) ?? { id: '', name: '', arguments: '' };
    const fn = object(delta.function);
    if (typeof delta.id === 'string' && delta.id !== call.id) call.id += delta.id;
    if (typeof fn?.name === 'string' && fn.name) {
      call.name += fn.name;
      onName?.(call.name);
    }
    if (typeof fn?.arguments === 'string') call.arguments += fn.arguments;
    calls.set(index, call);
  });
}

function assembleCalls(calls: Map<number, PartialCall>): OpenAiToolCall[] {
  return [...calls.entries()].sort(([a], [b]) => a - b).map(([index, call]) => {
    if (!call.name) throw new AiApiError('invalid_response', 'Cloudborne returned a tool call without a name');
    return { id: call.id || `call_${index}`, type: 'function', function: { name: call.name, arguments: call.arguments } };
  });
}

function completionChoice(value: unknown): Record<string, unknown> | undefined {
  const root = object(value);
  if (root?.error) throw new AiApiError('invalid_response', 'Cloudborne returned a chat error');
  if (Array.isArray(root?.choices)) return object(root.choices[0]);
  return undefined;
}

function completeJson(value: unknown, opts: ChatOptions): Completion {
  const choice = completionChoice(value);
  const message = object(choice?.message) ?? object(value);
  const content = message?.content;
  const calls = new Map<number, PartialCall>();
  appendCalls(calls, message?.tool_calls, opts.onToolCallDelta);
  if (typeof content !== 'string' && !calls.size) throw new AiApiError('invalid_response', 'Invalid Cloudborne chat response');
  if (typeof content === 'string' && content) opts.onTextDelta?.(content);
  const finishReason = choice?.finish_reason ?? message?.finish_reason;
  return { content: typeof content === 'string' ? content : '', toolCalls: assembleCalls(calls), finishReason: typeof finishReason === 'string' ? finishReason : undefined };
}

async function readStream(response: Response, opts: ChatOptions): Promise<Completion> {
  if (!response.body) throw new AiApiError('invalid_response', 'Cloudborne response has no stream');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const calls = new Map<number, PartialCall>();
  let remainder = '';
  let data: string[] = [];
  let content = '';
  let finishReason: string | undefined;
  let terminal = false;
  let hasChoice = false;

  const handleFrame = (frame: string) => {
    const trimmed = frame.trim();
    if (!trimmed) return;
    if (trimmed === '[DONE]') { terminal = true; return; }
    let value: unknown;
    try { value = JSON.parse(trimmed); } catch { throw new AiApiError('invalid_response', 'Invalid Cloudborne stream event'); }
    const choice = completionChoice(value);
    if (!choice) return; // Usage-only frames can have an empty choices array.
    hasChoice = true;
    const delta = object(choice.delta) ?? object(choice.message);
    if (typeof delta?.content === 'string' && delta.content) {
      content += delta.content;
      opts.onTextDelta?.(delta.content);
    }
    appendCalls(calls, delta?.tool_calls, opts.onToolCallDelta);
    if (typeof choice.finish_reason === 'string') finishReason = choice.finish_reason;
  };

  const dispatch = () => {
    const lines = data;
    data = [];
    if (!lines.length) return;
    const payload = lines.join('\n').trim();
    if (!payload) return;
    if (payload === '[DONE]') { terminal = true; return; }
    try {
      handleFrame(payload);
    } catch (error) {
      if (lines.length <= 1) throw error;
      for (const line of lines) {
        if (terminal) break;
        handleFrame(line);
      }
    }
  };

  const readLine = (line: string) => {
    if (!line) dispatch();
    else if (line === 'data' || line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  };

  const consume = (text: string, end: boolean) => {
    remainder += text;
    const lines = remainder.split(/\r\n|\n|\r(?!$)/);
    remainder = lines.pop() ?? '';
    for (const line of lines) {
      readLine(line);
      if (terminal) break;
    }
    if (end && !terminal) {
      if (remainder) readLine(remainder.replace(/\r$/, ''));
      if (!terminal) dispatch();
    }
  };

  const cancel = () => { void reader.cancel().catch(() => undefined); };
  opts.signal?.addEventListener('abort', cancel, { once: true });
  try {
    while (!terminal) {
      checkAbort(opts.signal);
      let part: ReadableStreamReadResult<Uint8Array>;
      try { part = await reader.read(); } catch (error) { throw transportError(error, opts.signal); }
      checkAbort(opts.signal);
      consume(decoder.decode(part.value, { stream: !part.done }), part.done);
      if (part.done) break;
    }
  } finally {
    opts.signal?.removeEventListener('abort', cancel);
    cancel();
    reader.releaseLock();
  }
  if (!hasChoice) throw new AiApiError('invalid_response', 'Cloudborne stream contains no choices');
  return { content, toolCalls: assembleCalls(calls), finishReason };
}

export async function streamChatCompletion(opts: ChatOptions): Promise<Completion> {
  const response = await request('/chat/completions', opts.apiKey, opts, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      ...(opts.tools?.length ? { tools: opts.tools } : {}),
      ...(opts.temperature === undefined ? {} : { temperature: opts.temperature }),
      stream: true,
    }),
  });
  if (response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) return readStream(response, opts);
  return completeJson(await readJson(response, opts.signal), opts);
}
