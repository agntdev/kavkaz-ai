import type { Ctx } from "./bot.js";

export type Language = "ru" | "en";
export type Flow = "idle" | "chat" | "report-category" | "report-description" | "profile-name" | "profile-timezone" | "rename";

export interface StoredMessage {
  id: string;
  author: "user" | "assistant";
  text: string;
  timestamp: number;
  saved: boolean;
  pinned: boolean;
}

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  lastActivityAt: number;
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
  profile?: StoredProfile;
  conversations: StoredConversation[];
  reports: StoredReport[];
}

export function stateOf(ctx: Ctx): AppState {
  const session = ctx.session as Ctx["session"] & Partial<AppState>;
  const state = session as AppState;
  if (!Array.isArray(state.conversations)) state.conversations = [];
  if (!Array.isArray(state.reports)) state.reports = [];
  if (typeof state.nextConversation !== "number") state.nextConversation = 1;
  if (!state.flow) state.flow = "idle";
  if (!state.profile) {
    state.profile = {
      displayName: ctx.from?.first_name ?? "Друг",
      language: "ru",
      timezone: "UTC",
      historyRetentionDays: 90,
      compactReplies: false,
      messagesThisMonth: 0,
    };
  }
  return state;
}

/** Single clock seam for all retention, audit, and activity timestamps. */
export function now(): number {
  return Date.now();
}

export function menuBack() {
  return { inline_keyboard: [[{ text: "⬅️ Back to menu", callback_data: "menu:main" }]] };
}

export function activeConversation(state: AppState): StoredConversation | undefined {
  return state.conversations.find((c) => c.id === state.activeConversationId && !c.deleted);
}

