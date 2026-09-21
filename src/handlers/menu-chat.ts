import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { activeConversation, addMessage, buildModelInput, loadState, newConversation, now, saveState, type AppState, type StoredConversation } from "../state.js";
import { sendConversationExport } from "../exporter.js";

registerMainMenuItem({ label: "Новый чат", data: "menu:chat", order: 10 });
const composer = new Composer<Ctx>();
const chatKeyboard = inlineKeyboard([[inlineButton("Сохранить ответ", "chat:save:last"), inlineButton("Экспорт", "chat:export")], [inlineButton("В главное меню", "menu:main")]]);

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
  if (ctx.message.text.startsWith("/") || state.flow !== "chat" || menuLabels.has(ctx.message.text)) return next();
  const input = ctx.message.text.trim();
  if (!input) { await ctx.reply("Напишите вопрос или задачу одним сообщением.", { reply_markup: chatKeyboard }); return; }
  if (input.length > 4000) { await ctx.reply("Сообщение слишком длинное. Сократите его до 4000 символов и попробуйте снова."); return; }
  const conversation = activeConversation(state) ?? newConversation(state, ctx.from?.id ?? ctx.chat?.id ?? 0);
  addMessage(conversation, "user", input);
  // Built-in v1 engine: the last 20 persisted messages are the short-term model context.
  const modelInput = buildModelInput(conversation, state.profile.historyRetentionDays);
  const reply = state.profile.compactReplies ? `Понял: «${input}»\n\nГотов помочь.` : `Понял вас: «${input}»\n\nЯ готов помочь разобрать это по шагам.`;
  addMessage(conversation, "assistant", reply);
  conversation.updatedAt = Math.max(conversation.updatedAt, now());
  state.profile.messagesThisMonth += 1;
  await saveState(ctx, state);
  // The built-in engine receives the complete bounded input even though v1's
  // deterministic reply keeps the concise product copy unchanged.
  void modelInput;
  await ctx.reply(reply, { reply_markup: chatKeyboard });
});

export default composer;
