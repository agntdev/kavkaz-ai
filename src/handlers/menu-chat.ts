import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { activeConversation, now, stateOf, type StoredConversation } from "../state.js";
import { sendConversationExport } from "../exporter.js";

registerMainMenuItem({ label: "💬 Chat", data: "menu:chat", order: 10 });
const composer = new Composer<Ctx>();
const chatKeyboard = inlineKeyboard([
  [inlineButton("💾 Save last reply", "chat:save:last"), inlineButton("📄 Export", "chat:export")],
  [inlineButton("⬅️ Back to menu", "menu:main")],
]);

function openConversation(ctx: Ctx) {
  const state = stateOf(ctx);
  let conversation = activeConversation(state);
  if (!conversation) {
    conversation = {
      id: `c${state.nextConversation++}`,
      title: "Новый разговор",
      createdAt: now(),
      lastActivityAt: now(),
      messages: [],
    } satisfies StoredConversation;
    state.conversations.push(conversation);
    state.activeConversationId = conversation.id;
  }
  state.flow = "chat";
  return conversation;
}

composer.callbackQuery("menu:chat", async (ctx) => {
  await ctx.answerCallbackQuery();
  openConversation(ctx);
  await ctx.reply("Open or continue the active conversation (start new if none)", { reply_markup: chatKeyboard });
});

composer.callbackQuery("chat:save:last", async (ctx) => {
  await ctx.answerCallbackQuery();
  const conversation = activeConversation(stateOf(ctx));
  const last = conversation?.messages.at(-1);
  if (!last) return ctx.reply("Пока нечего сохранять — напишите сообщение.", { reply_markup: chatKeyboard });
  last.saved = true;
  last.pinned = true;
  await ctx.reply("Сохранил последний ответ.", { reply_markup: chatKeyboard });
});
composer.callbackQuery("chat:export", async (ctx) => { await ctx.answerCallbackQuery(); await sendConversationExport(ctx, activeConversation(stateOf(ctx))); });

composer.on("message:text", async (ctx, next) => {
  const state = stateOf(ctx);
  if (ctx.message.text.startsWith("/") || state.flow !== "chat") return next();
  const input = ctx.message.text.trim();
  if (!input) return ctx.reply("Напишите вопрос или задачу одним сообщением.", { reply_markup: chatKeyboard });
  if (input.length > 4000) return ctx.reply("Сообщение слишком длинное. Сократите его до 4000 символов и попробуйте снова.");
  const conversation = openConversation(ctx);
  const timestamp = now();
  conversation.messages.push({ id: `m${timestamp}-${conversation.messages.length}`, author: "user", text: input, timestamp, saved: false, pinned: false });
  const reply = `Понял вас: «${input}»\n\nЯ готов помочь разобрать это по шагам.`;
  conversation.messages.push({ id: `m${timestamp}-${conversation.messages.length}`, author: "assistant", text: reply, timestamp: now(), saved: false, pinned: false });
  conversation.lastActivityAt = now();
  state.profile!.messagesThisMonth += 1;
  await ctx.reply(reply, { reply_markup: chatKeyboard });
});

export default composer;
