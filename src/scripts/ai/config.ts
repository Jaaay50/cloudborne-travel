import { ITEM_RE } from '../../lib/keys';
import type { AgentPlan, AgentSession, AiConfig, ChatMessage, ModelInfo, PersonalProfile, StopKind, ToolTrace } from './types';

const CONFIG_KEY = 'cbt.ai.config.v1';
const PROFILE_KEY = 'cbt.ai.profile.v1';
const SESSIONS_KEY = 'cbt.ai.sessions.v1';
const MAX_SESSIONS = 12;

type ConfigStorage = { local?: Storage; session?: Storage };
type Stop = AgentPlan['days'][number]['stops'][number];

function browserStorage(kind: 'local' | 'session'): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function read(storage: Storage | undefined, key: string): unknown {
  try {
    return JSON.parse(storage?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Access and writes can fail in private mode or when storage is full.
  }
}

function remove(storage: Storage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Access can fail in private mode.
  }
}

function configStorage(storage?: ConfigStorage): ConfigStorage {
  return storage ?? { local: browserStorage('local'), session: browserStorage('session') };
}

const str = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
const time = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
const list = <T>(value: unknown, clean: (row: unknown) => T | undefined) =>
  Array.isArray(value) ? value.map(clean).filter((row): row is T => row !== undefined) : [];

function configMetadata(value: unknown): Omit<AiConfig, 'apiKey'> {
  const raw = object(value);
  const cfg: Omit<AiConfig, 'apiKey'> = {
    model: str(raw.model, 500),
    persist: raw.persist === 'session' ? 'session' : 'local',
  };
  if (Array.isArray(raw.cachedModels)) {
    cfg.cachedModels = list(raw.cachedModels, (value): ModelInfo | undefined => {
      const row = object(value);
      const id = str(row.id, 500);
      if (!id || (row.category !== 'chat' && row.category !== 'other')) return undefined;
      return {
        id,
        category: row.category,
        ...(typeof row.ownedBy === 'string' ? { ownedBy: str(row.ownedBy, 200) } : {}),
        ...(typeof row.recommended === 'boolean' ? { recommended: row.recommended } : {}),
      };
    });
  }
  if (typeof raw.cachedAt === 'number' && Number.isFinite(raw.cachedAt)) cfg.cachedAt = raw.cachedAt;
  return cfg;
}

export function loadAiConfig(storage?: ConfigStorage): AiConfig {
  const { local, session } = configStorage(storage);
  const raw = object(read(local, CONFIG_KEY));
  const cfg = configMetadata(raw);
  const apiKey = cfg.persist === 'local' ? raw.apiKey : object(read(session, CONFIG_KEY)).apiKey;
  return { ...cfg, apiKey: typeof apiKey === 'string' ? apiKey : '' };
}

export function saveAiConfig(cfg: AiConfig, storage?: ConfigStorage): void {
  const { local, session } = configStorage(storage);
  const metadata = configMetadata(cfg);
  const apiKey = typeof cfg.apiKey === 'string' ? cfg.apiKey : '';
  if (metadata.persist === 'session') {
    remove(local, CONFIG_KEY);
    write(local, CONFIG_KEY, metadata);
    write(session, CONFIG_KEY, { apiKey });
  } else {
    remove(session, CONFIG_KEY);
    write(local, CONFIG_KEY, { ...metadata, apiKey });
  }
}

export function clearAiKey(storage?: ConfigStorage): void {
  const { local, session } = configStorage(storage);
  const raw = read(local, CONFIG_KEY);
  remove(session, CONFIG_KEY);
  remove(local, CONFIG_KEY);
  if (raw !== null) write(local, CONFIG_KEY, configMetadata(raw));
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  return key.length <= 8 ? '••••' : `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function emptyProfile(): PersonalProfile {
  return { departureCity: '', companions: '', budget: '', pace: '', interests: [], avoid: '', notes: '' };
}

function cleanProfile(value: unknown): PersonalProfile {
  const raw = object(value);
  const profile = emptyProfile();
  for (const key of ['departureCity', 'companions', 'budget', 'pace', 'avoid', 'notes'] as const) {
    profile[key] = str(raw[key], 500);
  }
  profile.interests = list(raw.interests, (value) => str(value, 80) || undefined).slice(0, 30);
  return profile;
}

export function loadProfile(storage?: Storage): PersonalProfile {
  return cleanProfile(read(storage ?? browserStorage('local'), PROFILE_KEY));
}

export function saveProfile(profile: PersonalProfile, storage?: Storage): void {
  write(storage ?? browserStorage('local'), PROFILE_KEY, cleanProfile(profile));
}

function cleanMessage(value: unknown): ChatMessage | undefined {
  const raw = object(value);
  if (typeof raw.id !== 'string' || typeof raw.content !== 'string' || (raw.role !== 'user' && raw.role !== 'assistant')) return undefined;
  const message: ChatMessage = { id: str(raw.id, 100), role: raw.role, content: raw.content, createdAt: time(raw.createdAt) };
  if (typeof raw.error === 'string') message.error = str(raw.error, 500);
  if (Array.isArray(raw.traces)) {
    message.traces = list(raw.traces, (value): ToolTrace | undefined => {
      const trace = object(value);
      if (typeof trace.id !== 'string' || typeof trace.name !== 'string' || typeof trace.ok !== 'boolean') return undefined;
      return { id: str(trace.id, 100), name: str(trace.name, 100), summary: str(trace.summary, 500), ok: trace.ok };
    });
  }
  return message;
}

function cleanStop(value: unknown): Stop | undefined {
  const raw = object(value);
  const kind = raw.kind as StopKind;
  if (!['spot', 'food', 'transport', 'hotel', 'shopping', 'tip'].includes(kind)) return undefined;
  const id = str(raw.id, 100), name = str(raw.name, 160);
  if (!id || !name) return undefined;
  const stop: Stop = { id, name, kind };
  for (const key of ['timeSlot', 'duration', 'cost', 'note', 'mapQuery', 'place'] as const) {
    if (typeof raw[key] === 'string') stop[key] = str(raw[key], 500);
  }
  if (typeof raw.catalogKey === 'string' && ITEM_RE.test(raw.catalogKey)
    && ((kind === 'spot' && raw.catalogKey.startsWith('s:')) || (kind === 'food' && raw.catalogKey.startsWith('f:')))) {
    stop.catalogKey = raw.catalogKey;
  }
  return stop;
}

function cleanPlan(value: unknown): AgentPlan | null {
  const raw = object(value);
  if (typeof raw.title !== 'string' || !Array.isArray(raw.days)) return null;
  const plan: AgentPlan = {
    title: str(raw.title, 160),
    updatedAt: time(raw.updatedAt),
    tips: list(raw.tips, (value) => str(value, 300) || undefined).slice(0, 30),
    bases: list(raw.bases, (value) => {
      const base = object(value);
      const place = str(base.place, 500);
      return place && Number.isInteger(base.nights) && Number(base.nights) >= 0 ? { place, nights: Number(base.nights) } : undefined;
    }).slice(0, 20),
    days: list(raw.days, (value): AgentPlan['days'][number] | undefined => {
      const row = object(value);
      if (typeof row.day !== 'number' || !Number.isSafeInteger(row.day) || row.day < 1) return undefined;
      const day: AgentPlan['days'][number] = { day: row.day, title: str(row.title, 160), stops: list(row.stops, cleanStop).slice(0, 30) };
      for (const key of ['place', 'stay', 'move', 'note'] as const) {
        if (typeof row[key] === 'string') day[key] = str(row[key], 500);
      }
      return day;
    }).slice(0, 60),
  };
  if (raw.country === 'japan' || raw.country === 'australia' || raw.country === 'usa' || raw.country === 'mixed') plan.country = raw.country;
  if (typeof raw.summary === 'string') plan.summary = str(raw.summary, 500);
  if (typeof raw.budgetNote === 'string') plan.budgetNote = str(raw.budgetNote, 500);
  return plan;
}

function cleanSessions(value: unknown): AgentSession[] {
  return list(value, (value): AgentSession | undefined => {
    const raw = object(value);
    if (typeof raw.id !== 'string' || !raw.id || typeof raw.title !== 'string') return undefined;
    return {
      id: str(raw.id, 100), title: str(raw.title, 100), createdAt: time(raw.createdAt), updatedAt: time(raw.updatedAt),
      messages: list(raw.messages, cleanMessage).slice(-100),
      plan: cleanPlan(raw.plan),
    };
  }).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
}

export function loadSessions(storage?: Storage): AgentSession[] {
  return cleanSessions(read(storage ?? browserStorage('local'), SESSIONS_KEY));
}

export function saveSessions(sessions: AgentSession[], storage?: Storage): void {
  write(storage ?? browserStorage('local'), SESSIONS_KEY, cleanSessions(sessions));
}

export function createSession(title = '新行程'): AgentSession {
  const now = Date.now();
  const id = globalThis.crypto?.randomUUID?.() ?? `ai-${now}-${Math.random().toString(36).slice(2)}`;
  return { id, title: str(title, 100), createdAt: now, updatedAt: now, messages: [], plan: null };
}
