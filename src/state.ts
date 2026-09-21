import type { Ctx } from "./bot.js";
import { inlineButton, inlineKeyboard } from "./toolkit/index.js";

export type Language = "ru" | "en";
export type Flow = "idle" | "chat" | "report-category" | "report-description" | "profile-name" | "profile-timezone" | "rename";

export interface StoredMessage {
  messageId: string;
  conversationId: string;
  senderType: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  contentMeta: { saved?: boolean; pinned?: boolean };
}

export interface StoredConversation {
  conversationId: string;
  userId: number;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
  deleted?: boolean;
}

export interface StoredProfile {
  displayName: string;
  language: Language;
  timezone: string;
  historyRetentionDays: 30 | 90 | 365;
  compactReplies: boolean;
  messagesThisMonth: number;
}

export interface StoredReport {
  id: string;
  category: string;
  description: string;
  submittedAt: number;
  notifiedAdminAt?: number;
}

export interface AppState {
  flow: Flow;
  flowValue?: string;
  activeConversationId?: string;
  nextConversation: number;
  profile: StoredProfile;
  conversations: StoredConversation[];
  reports: StoredReport[];
}

const KEY_PREFIX = "domain:user:";

let clock: () => number = () => Date.now();
export function now(): number { return clock(); }
export function setClock(next: (() => number) | undefined): void { clock = next ?? (() => Date.now()); }

function key(ctx: Ctx): string { return `${KEY_PREFIX}${ctx.chat?.id ?? ctx.from?.id ?? "unknown"}`; }

function defaults(ctx: Ctx): AppState {
  return {
    flow: "idle",
    nextConversation: 1,
    profile: { displayName: ctx.from?.first_name ?? "Друг", language: "ru", timezone: "UTC", historyRetentionDays: 90, compactReplies: false, messagesThisMonth: 0 },
    conversations: [],
    reports: [],
  };
}

/** Load durable domain data. Only flow state is mirrored to ctx.session. */
export async function loadState(ctx: Ctx): Promise<AppState> {
  const raw = await ctx.domainStore?.read(key(ctx));
  const state = (raw && typeof raw === "object" ? raw as Partial<AppState> : defaults(ctx));
  const result = { ...defaults(ctx), ...state, profile: { ...defaults(ctx).profile, ...(state.profile ?? {}) } } as AppState;
  result.conversations = Array.isArray(state.conversations) ? state.conversations : [];
  result.reports = Array.isArray(state.reports) ? state.reports : [];
  result.flow = (ctx.session.flow as Flow | undefined) ?? result.flow ?? "idle";
  result.flowValue = ctx.session.flowValue ?? result.flowValue;
  return result;
}

export async function saveState(ctx: Ctx, state: AppState): Promise<void> {
  ctx.session.flow = state.flow;
  ctx.session.flowValue = state.flowValue;
  await ctx.domainStore?.write(key(ctx), state);
}

export function activeConversation(state: AppState): StoredConversation | undefined {
  return state.conversations.find((c) => c.conversationId === state.activeConversationId && !c.deleted);
}

export function newConversation(state: AppState, userId: number): StoredConversation {
  const stamp = now();
  const conversation: StoredConversation = { conversationId: `c${userId}-${state.nextConversation++}`, userId, title: "Новый разговор", createdAt: stamp, updatedAt: stamp, messages: [] };
  state.conversations.push(conversation);
  state.activeConversationId = conversation.conversationId;
  return conversation;
}

export function addMessage(conversation: StoredConversation, senderType: StoredMessage["senderType"], content: string): StoredMessage {
  const message: StoredMessage = { messageId: `${conversation.conversationId}-m${conversation.messages.length + 1}`, conversationId: conversation.conversationId, senderType, content, timestamp: now(), contentMeta: {} };
  conversation.messages.push(message);
  conversation.updatedAt = message.timestamp;
  return message;
}

export function menuBack() { return inlineKeyboard([[inlineButton("В главное меню", "menu:main")]]); }

export function messageLabel(message: StoredMessage): string {
  return `${message.senderType === "user" ? "Вы" : message.senderType === "assistant" ? "Ассистент" : "Система"}: ${message.content}`;
}

/** Model input policy: retention cutoff first, then the most recent 20 turns. */
export function buildModelInput(conversation: StoredConversation, retentionDays: number): string {
  const cutoff = now() - retentionDays * 86400000;
  return conversation.messages
    .filter((message) => message.timestamp >= cutoff)
    .slice(-20)
    .map((message) => `${message.senderType}: ${message.content}`)
    .join("\n");
}
