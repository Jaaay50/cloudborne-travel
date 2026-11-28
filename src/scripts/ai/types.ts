export const CLOUDBORNE_BASE_URL = 'https://api.cloudborne.cn/v1';
export const CLOUDBORNE_KEY_URL = 'https://cloudborne.cn';

export type KeyStorageMode = 'local' | 'session';

export interface ModelInfo { id: string; ownedBy?: string; category: 'chat' | 'other'; recommended?: boolean }
export interface AiConfig { apiKey: string; model: string; persist: KeyStorageMode; cachedModels?: ModelInfo[]; cachedAt?: number }
export interface PersonalProfile { departureCity: string; companions: string; budget: string; pace: string; interests: string[]; avoid: string; notes: string }
export type StopKind = 'spot' | 'food' | 'transport' | 'hotel' | 'shopping' | 'tip';
export interface AgentStop { id: string; catalogKey?: string; name: string; kind: StopKind; timeSlot?: string; duration?: string; cost?: string; note?: string; mapQuery?: string; place?: string }
export interface AgentDay { day: number; title: string; place?: string; stay?: string; move?: string; note?: string; stops: AgentStop[] }
export interface AgentPlan { title: string; country?: 'japan' | 'australia' | 'usa' | 'mixed'; summary?: string; bases: { place: string; nights: number }[]; days: AgentDay[]; tips: string[]; budgetNote?: string; updatedAt: number }
export interface ToolTrace { id: string; name: string; summary: string; ok: boolean }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; createdAt: number; traces?: ToolTrace[]; error?: string }
export interface AgentSession { id: string; title: string; createdAt: number; updatedAt: number; messages: ChatMessage[]; plan: AgentPlan | null }
export type AiErrorCode = 'missing_key' | 'unauthorized' | 'forbidden' | 'rate_limit' | 'cors_or_network' | 'bad_request' | 'server_error' | 'aborted' | 'invalid_response';
export class AiApiError extends Error {
  code: AiErrorCode;
  status?: number;
  detail?: string;
  constructor(code: AiErrorCode, message: string, status?: number, detail?: string) {
    super(message);
    this.name = 'AiApiError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}
export interface OpenAiToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface OpenAiMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: OpenAiToolCall[]; tool_call_id?: string; name?: string }
export interface OpenAiToolDef { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
