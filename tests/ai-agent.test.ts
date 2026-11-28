import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAiConfig, saveAiConfig, clearAiKey, emptyProfile, loadProfile, saveProfile, loadSessions, saveSessions, createSession } from '../src/scripts/ai/config';
import { fetchModels, streamChatCompletion } from '../src/scripts/ai/client';
import { AGENT_TOOLS, executeAgentTool, extractFallbackPlan, googleMapsUrl } from '../src/scripts/ai/tools';
import { buildSystemPrompt, exportAgentPlanToMarkdown, exportAgentPlanToTripState, importQuickPlanToAgentPlan, runAgentTurn } from '../src/scripts/ai/agent';
import type { Catalog } from '../src/scripts/catalog';
import type { AgentPlan, PersonalProfile } from '../src/scripts/ai/types';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, value) }
}
const catalog: Catalog = {
  p: [{ s: 'tokyo', c: 'japan', n: '东京', k: 'Tokyo', e: '', r: '', t: '', d: '', m: [1], i: '', ph: 0 }],
  s: [
    { k: 'tokyo/shibuya', n: '涩谷', l: '', e: '', d: 'city', t: '', h: [2, 3], x: 0, ll: [139.7, 35.66], th: ['city'], f: '' },
    { k: 'tokyo/asakusa', n: '浅草', l: '', e: '', d: 'culture', t: '', h: [2, 3], x: 0, ll: [139.79, 35.71], th: ['culture'], f: '' },
  ],
  f: [{ k: 'tokyo/sushi', n: '寿司', l: '', w: '鱼料理', pr: '' }], r: [], th: [], tr: [], to: [], tm: {}, tw: {}, rg: {}, tp: []
};
const profile = emptyProfile();
const jsonResponse = (value: unknown, status = 200, headers: Record<string, string> = { 'content-type': 'application/json' }) => new Response(JSON.stringify(value), { status, headers });

test('AI config keeps local and session API keys isolated and survives SSR storage absence', () => {
  const local = new MemoryStorage(), session = new MemoryStorage();
  saveAiConfig({ apiKey: 'sk-session-secret', model: 'm1', persist: 'session' }, { local, session });
  assert.equal(JSON.parse(local.getItem('cbt.ai.config.v1')!).apiKey, undefined);
  assert.equal(JSON.parse(session.getItem('cbt.ai.config.v1')!).apiKey, 'sk-session-secret');
  assert.equal(loadAiConfig({ local, session }).apiKey, 'sk-session-secret');
  saveAiConfig({ apiKey: 'sk-local-secret', model: 'm2', persist: 'local' }, { local, session });
  assert.equal(JSON.parse(local.getItem('cbt.ai.config.v1')!).apiKey, 'sk-local-secret');
  assert.equal(session.getItem('cbt.ai.config.v1'), null);
  clearAiKey({ local, session });
  assert.equal(loadAiConfig({ local, session }).apiKey, '');
  assert.doesNotThrow(() => saveAiConfig({ apiKey: 'x', model: '', persist: 'session' }));
});

test('profile and sessions sanitize safely and cap sessions at 12', () => {
  const storage = new MemoryStorage();
  const p: PersonalProfile = { departureCity: '上海', companions: '2', budget: 'mid', pace: 'easy', interests: ['food'], avoid: '', notes: 'n' };
  saveProfile(p, storage); assert.deepEqual(loadProfile(storage), p);
  const sessions = Array.from({ length: 14 }, (_, i) => ({ ...createSession(`s${i}`), updatedAt: i }));
  saveSessions(sessions, storage); assert.equal(loadSessions(storage).length, 12);
});

test('model parsing sorts chat recommendations and classifies errors without echoing key', async () => {
  const models = await fetchModels('secret-key', { fetchImpl: async (url) => { assert.equal(url, 'https://api.cloudborne.cn/v1/models'); return jsonResponse({ data: [{ id: 'other-x', owned_by: 'x' }, { id: 'gpt-test', owned_by: 'x' }] }) as Response } });
  assert.deepEqual(models.map((m) => m.id), ['gpt-test', 'other-x']);
  for (const [status, code] of [[401, 'unauthorized'], [403, 'forbidden'], [429, 'rate_limit']] as const) {
    await assert.rejects(() => fetchModels('secret-key', { fetchImpl: async () => jsonResponse({ error: 'secret-key leaked?' }, status) as Response }), (e: any) => e.code === code && !e.message.includes('secret-key'));
  }
  await assert.rejects(() => fetchModels('x', { fetchImpl: async () => { throw new TypeError('Failed to fetch') } }), (e: any) => e.code === 'cors_or_network');
});

test('SSE handles partial UTF-8 chunks and reassembles tool calls', async () => {
  const source = [
    'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"好","tool_calls":[{"index":0,"id":"call-1","function":{"name":"search_"}}]}}]}\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"catalog","arguments":"{\\"query\\":"}}]}}]}\n\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"东京\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n', 'data: [DONE]\n\n'
  ].join('');
  const bytes = new TextEncoder().encode(source), chunks = [bytes.slice(0, 25), bytes.slice(25, 28), bytes.slice(28)];
  const body = new ReadableStream<Uint8Array>({ start(controller: ReadableStreamDefaultController<Uint8Array>) { chunks.forEach((x) => controller.enqueue(x)); controller.close() } });
  const seen: string[] = [];
  const result = await streamChatCompletion({ apiKey: 'x', model: 'm', messages: [], fetchImpl: async (url) => { assert.equal(url, 'https://api.cloudborne.cn/v1/chat/completions'); return new Response(body, { headers: { 'content-type': 'text/event-stream' } }) }, onTextDelta: (x) => seen.push(x) });
  assert.equal(seen.join(''), '你好'); assert.equal(result.content, '你好'); assert.equal(result.toolCalls[0].function.name, 'search_catalog'); assert.equal(result.toolCalls[0].function.arguments, '{"query":"东京"}');
});

test('all six tools validate catalog keys and optimize route', () => {
  assert.equal(AGENT_TOOLS.length, 6); assert.match(googleMapsUrl('东京站'), /query=%E4%B8%9C%E4%BA%AC%E7%AB%99/);
  const base: AgentPlan = { title: '东京', bases: [], days: [{ day: 1, title: '一日', stops: [{ id: 'a', catalogKey: 's:tokyo/asakusa', name: '浅草', kind: 'spot' }, { id: 'b', catalogKey: 's:tokyo/shibuya', name: '涩谷', kind: 'spot' }] }], tips: [], updatedAt: Date.now() };
  let out = executeAgentTool('set_itinerary', JSON.stringify({ plan: base }), { catalog, plan: null, profile }); assert.equal(out.planChanged, true);
  out = executeAgentTool('update_day', JSON.stringify({ day: 1, stops: [{ catalogKey: 's:tokyo/shibuya' }, { catalogKey: 's:tokyo/asakusa' }] }), { catalog, plan: out.plan, profile });
  out = executeAgentTool('optimize_day_route', JSON.stringify({ day: 1 }), { catalog, plan: out.plan, profile }); assert.equal(out.plan?.days[0].stops[0].catalogKey, 's:tokyo/shibuya');
  const bad = executeAgentTool('get_place_detail', JSON.stringify({ catalogKey: 's:tokyo/nope' }), { catalog, plan: out.plan, profile }); assert.equal(bad.trace.ok, false);
  const prof = executeAgentTool('update_profile', JSON.stringify({ budget: 'save', interests: ['food'] }), { catalog, plan: out.plan, profile }); assert.equal(prof.profileChanged, true);
  const search = executeAgentTool('search_catalog', JSON.stringify({ query: '寿司' }), { catalog, plan: out.plan, profile }); assert.match(search.resultJson, /sushi/);
});

test('agent loop retries without tools and extracts fallback plan', async () => {
  const session = createSession('测试'); const calls: Array<{ tools?: unknown }> = [];
  const fallback = '可以这样安排\n```cbt-plan\n{"title":"东京三日","days":[{"day":1,"title":"市区","stops":[{"catalogKey":"s:tokyo/shibuya"}]}],"bases":[],"tips":[],"updatedAt":1}\n```';
  const fetchImpl: typeof fetch = async (_url, init) => { calls.push(JSON.parse(String(init?.body))); if (calls.length === 1) return jsonResponse({ error: { message: 'tools unsupported' } }, 400) as Response; return new Response(new ReadableStream<Uint8Array>({ start(c: ReadableStreamDefaultController<Uint8Array>) { c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: fallback } }] })}\n\ndata: [DONE]\n\n`)); c.close() } }), { headers: { 'content-type': 'text/event-stream' } }) };
  const result = await runAgentTurn({ apiKey: 'x', model: 'm', lang: 'zh', catalog, session, userMessage: '安排三天', profile, fetchImpl });
  assert.equal(calls.length, 2); assert.equal(result.plan?.title, '东京三日'); assert.equal(result.assistantMessage.content, '可以这样安排');
  assert.match(buildSystemPrompt({ lang: 'ja', profile, plan: null, useTools: false }), /2026/);
});

test('QuickPlan, TripState and Markdown conversions preserve catalog items', () => {
  const quick = { title: '东京两日', days: [{ place: 'tokyo', items: ['s:tokyo/shibuya', 'f:tokyo/sushi'] }], bases: [{ place: 'tokyo', nights: 1 }], tips: ['早点出发'] };
  const plan = importQuickPlanToAgentPlan(quick, catalog, 'japan'); const exported = exportAgentPlanToTripState(plan, catalog, '2026-05-01');
  assert.deepEqual(exported.trip.days, [['s:tokyo/shibuya', 'f:tokyo/sushi']]); assert.equal(exported.matchedCount, 2); assert.equal(exported.customCount, 0);
  assert.match(exportAgentPlanToMarkdown(plan, 'zh'), /# 东京两日/);
  const extracted = extractFallbackPlan('前言\n```cbt-plan\n' + JSON.stringify(plan) + '\n```\n结语', catalog); assert.equal(extracted.plan?.title, plan.title); assert.equal(extracted.cleanText, '前言\n\n结语');
});
