import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { activeConversation, addMessage, buildModelMessages, loadState, newConversation, now, saveState, type AppState, type StoredConversation } from "../state.js";
import { sendConversationExport } from "../exporter.js";
import { adminChatId } from "../toolkit/index.js";

registerMainMenuItem({ label: "Новый чат", data: "menu:chat", order: 10 });
const composer = new Composer<Ctx>();
const chatKeyboard = inlineKeyboard([[inlineButton("Сохранить ответ", "chat:save:last"), inlineButton("Экспорт", "chat:export")], [inlineButton("В главное меню", "menu:main")]]);
const AI_FAILURE = "Сервис временно недоступен, попробуйте позже.";
const AI_TIMEOUT_MS = 15_000;
const MAX_REPLY_LENGTH = 4096;

type RuntimeCtx = Ctx & { env?: Record<string, unknown> };

function setting(ctx: RuntimeCtx, ...names: string[]): string | undefined {
  for (const name of names) {
    const workerValue = ctx.env?.[name];
    if (typeof workerValue === "string" && workerValue.trim()) return workerValue.trim();
    if (typeof workerValue === "number" && Number.isFinite(workerValue)) return String(workerValue);
    if (typeof process !== "undefined" && process.env?.[name]?.trim()) return process.env[name]!.trim();
  }
  return undefined;
}

function requestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `update-${Date.now()}`;
}

function retryable(status: number): boolean { return status === 429 || status >= 500; }

function timeoutMs(ctx: RuntimeCtx): number {
  const configured = Number(setting(ctx, "AI_TIMEOUT_MS") ?? AI_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1000 && configured <= 120_000 ? configured : AI_TIMEOUT_MS;
}

function backoff(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
}

async function requestAi(ctx: RuntimeCtx, state: AppState, conversation: StoredConversation): Promise<{ text: string; requestId: string }> {
  const endpoint = setting(ctx, "AI_API_URL", "AI_ENDPOINT", "OPENAI_API_URL", "OPENROUTER_API_URL");
  if (!endpoint) throw new Error("AI endpoint is not configured");
  const id = requestId();
  const model = setting(ctx, "AI_MODEL", "OPENAI_MODEL", "OPENROUTER_MODEL");
  const apiKey = setting(ctx, "AI_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY");
  const profile = state.profile;
  const messages = [
    { role: "system", content: "Ты Kavkaz AI — тёплый и лаконичный русскоязычный помощник. Отвечай по делу, помогай с вопросами, текстами и задачами. Учитывай язык пользователя и не выдумывай факты." },
    { role: "system", content: `Профиль пользователя: имя «${profile.displayName}», язык «${profile.language}», часовой пояс «${profile.timezone}», формат ответов: ${profile.compactReplies ? "короткий" : "обычный"}.` },
    ...buildModelMessages(conversation, profile.historyRetentionDays),
  ];
  const body: Record<string, unknown> = { messages, ...(model ? { model } : {}) };
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs(ctx));
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}), "x-request-id": id },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const raw = await response.text();
      if (!response.ok) {
        const failure = new Error(`AI HTTP ${response.status}: ${raw.slice(0, 160)}`);
        if (retryable(response.status) && attempt === 0) { lastError = failure; await backoff(attempt); continue; }
        throw failure;
      }
      const payload = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("AI returned an empty response");
      return { text: text.slice(0, MAX_REPLY_LENGTH), requestId: id };
    } catch (error) {
      lastError = error;
      if (attempt === 0 && !(error instanceof SyntaxError) && !(error instanceof Error && error.message.startsWith("AI HTTP 4"))) {
        await backoff(attempt);
        continue;
      }
    } finally { clearTimeout(timer); }
  }
  throw Object.assign(new Error("AI request failed"), { cause: lastError, requestId: id });
}

async function notifyFailure(ctx: RuntimeCtx, error: unknown, id: string): Promise<void> {
  const owner = adminChatId(ctx);
  if (!owner) return;
  const detail = error instanceof Error ? error.message : "unknown error";
  try { await ctx.api.sendMessage(owner, `Сбой AI\nЗапрос: ${id}\nПричина: ${detail.slice(0, 300)}`); } catch { /* reporting must not block the user */ }
}

export async function openConversation(ctx: Ctx, startNew = false): Promise<{ state: AppState; conversation: StoredConversation }> {
  const state = await loadState(ctx);
  let conversation = startNew ? undefined : activeConversation(state);
  if (!conversation) conversation = newConversation(state, ctx.from?.id ?? ctx.chat?.id ?? 0);
  state.flow = "chat";
  await saveState(ctx, state);
  return { state, conversation };
}

async function open(ctx: Ctx, startNew = false) { await openConversation(ctx, startNew); await ctx.reply("Новый чат открыт. Напишите вопрос или задачу.", { reply_markup: chatKeyboard }); }

composer.callbackQuery("menu:chat", async (ctx) => { await ctx.answerCallbackQuery(); await open(ctx, true); });
composer.hears("Новый чат", async (ctx) => { await open(ctx, true); });

composer.callbackQuery("chat:save:last", async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = await loadState(ctx); const conversation = activeConversation(state); const last = conversation?.messages.at(-1);
  if (!last) { await ctx.reply("Пока нечего сохранять — напишите сообщение.", { reply_markup: chatKeyboard }); return; }
  last.contentMeta.saved = true; last.contentMeta.pinned = true; await saveState(ctx, state);
  await ctx.reply("Сохранил последний ответ.", { reply_markup: chatKeyboard });
});
composer.callbackQuery("chat:export", async (ctx) => { await ctx.answerCallbackQuery(); const state = await loadState(ctx); await sendConversationExport(ctx, activeConversation(state)); });

composer.on("message:text", async (ctx, next) => {
  const state = await loadState(ctx);
  const menuLabels = new Set(["Новый чат", "Мои чаты", "Изображения", "Файлы", "Поиск", "Голос", "Профиль", "Тариф"]);
  if (ctx.message.text.startsWith("/") || menuLabels.has(ctx.message.text)) return next();
  if (state.flow !== "chat" && state.flow !== "idle") return next();
  const input = ctx.message.text.trim();
  if (!input) { await ctx.reply("Напишите вопрос или задачу одним сообщением.", { reply_markup: chatKeyboard }); return; }
  if (input.length > 4000) { await ctx.reply("Сообщение слишком длинное. Сократите его до 4000 символов и попробуйте снова."); return; }
  const conversation = activeConversation(state) ?? newConversation(state, ctx.from?.id ?? ctx.chat?.id ?? 0);
  addMessage(conversation, "user", input);
  state.profile.messagesThisMonth += 1;
  state.flow = "chat";
  await saveState(ctx, state);
  try {
    const result = await requestAi(ctx as RuntimeCtx, state, conversation);
    addMessage(conversation, "assistant", result.text);
    await saveState(ctx, state);
    await ctx.reply(result.text, { reply_markup: chatKeyboard });
  } catch (error) {
    const id = (error as { requestId?: string }).requestId ?? requestId();
    await notifyFailure(ctx as RuntimeCtx, error, id);
    await ctx.reply(AI_FAILURE, { reply_markup: chatKeyboard });
  }
});

export default composer;
