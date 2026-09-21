import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { loadState, messageLabel, saveState } from "../state.js";
import { sendConversationExport } from "../exporter.js";

registerMainMenuItem({ label: "Мои чаты", data: "menu:history:page:1", order: 20 });
const composer = new Composer<Ctx>();

async function render(ctx: Ctx, page: number) {
  const state = await loadState(ctx);
  const items = state.conversations.filter((c) => !c.deleted).sort((a, b) => b.updatedAt - a.updatedAt);
  const safePage = Math.max(1, page); const start = (safePage - 1) * 10; const shown = items.slice(start, start + 10);
  const text = shown.length ? "Ваши чаты" : "Пока нет сохранённых чатов — нажмите «Новый чат», чтобы начать.";
  const rows = shown.flatMap((c) => [[inlineButton(`Открыть ${c.title}`, `history:open:${c.conversationId}`)], [inlineButton("Переименовать", `history:rename:${c.conversationId}`), inlineButton("Удалить", `history:delete:${c.conversationId}`), inlineButton("Экспорт", `history:export:${c.conversationId}`)]]);
  const controls = []; if (safePage > 1) controls.push(inlineButton("⬅️ Назад", `history:page:${safePage - 1}`)); if (start + 10 < items.length) controls.push(inlineButton("Вперёд ➡️", `history:page:${safePage + 1}`)); if (controls.length) rows.push(controls);
  rows.push([inlineButton("В главное меню", "menu:main")]); await ctx.reply(text, { reply_markup: inlineKeyboard(rows) });
}

composer.callbackQuery("menu:history:page:1", async (ctx) => { await ctx.answerCallbackQuery(); await render(ctx, 1); });
composer.hears("Мои чаты", async (ctx) => { await render(ctx, 1); });
composer.callbackQuery(/^history:page:(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await render(ctx, Number(ctx.match[1])); });
composer.callbackQuery(/^history:open:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); const state = await loadState(ctx); const conversation = state.conversations.find((c) => c.conversationId === ctx.match[1] && !c.deleted);
  if (!conversation) { await ctx.reply("Разговор уже удалён."); return; }
  state.activeConversationId = conversation.conversationId; state.flow = "chat"; await saveState(ctx, state);
  const text = conversation.messages.length ? conversation.messages.map(messageLabel).join("\n\n") : "В этом разговоре пока нет сообщений.";
  await ctx.reply(text, { reply_markup: inlineKeyboard([[inlineButton("Экспорт", `history:export:${conversation.conversationId}`)], [inlineButton("⬅️ К истории", "menu:history:page:1")]]) });
});
composer.callbackQuery(/^history:delete:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const state = await loadState(ctx); const c = state.conversations.find((x) => x.conversationId === ctx.match[1] && !x.deleted); if (c) { c.deleted = true; c.messages = []; if (state.activeConversationId === c.conversationId) state.activeConversationId = undefined; } await saveState(ctx, state); await ctx.reply("Разговор удалён.", { reply_markup: inlineKeyboard([[inlineButton("К истории", "menu:history:page:1")]]) }); });
composer.callbackQuery(/^history:rename:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const state = await loadState(ctx); state.flow = "rename"; state.flowValue = ctx.match[1]; await saveState(ctx, state); await ctx.reply("Как назвать этот разговор?", { reply_markup: { force_reply: true, input_field_placeholder: "Новое название" } }); });
composer.callbackQuery(/^history:export:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const state = await loadState(ctx); await sendConversationExport(ctx, state.conversations.find((c) => c.conversationId === ctx.match[1])); });
composer.on("message:text", async (ctx, next) => { const state = await loadState(ctx); if (state.flow !== "rename") return next(); const c = state.conversations.find((x) => x.conversationId === state.flowValue && !x.deleted); const title = ctx.message.text.trim().slice(0, 80); if (c && title) c.title = title; state.flow = "idle"; state.flowValue = undefined; await saveState(ctx, state); await ctx.reply("Название обновлено.", { reply_markup: inlineKeyboard([[inlineButton("К истории", "menu:history:page:1")]]) }); });

export default composer;
