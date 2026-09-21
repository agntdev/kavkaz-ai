import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { stateOf } from "../state.js";
import { sendConversationExport } from "../exporter.js";

registerMainMenuItem({ label: "Мои чаты", data: "menu:history:page:1", order: 20 });
const composer = new Composer<Ctx>();

async function render(ctx: Ctx, page: number) {
  const state = stateOf(ctx);
  const items = state.conversations.filter((c) => !c.deleted).sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  const start = Math.max(0, page - 1) * 10;
  const shown = items.slice(start, start + 10);
  const text = shown.length ? "Ваши чаты" : "Пока нет сохранённых чатов — нажмите «Новый чат», чтобы начать.";
  const rows = shown.flatMap((c) => [[inlineButton(`Открыть ${c.title}`, `history:open:${c.id}`)], [inlineButton("Переименовать", `history:rename:${c.id}`), inlineButton("Удалить", `history:delete:${c.id}`), inlineButton("Экспорт", `history:export:${c.id}`)]]);
  const controls = [] as ReturnType<typeof inlineButton>[];
  if (page > 1) controls.push(inlineButton("⬅️ Назад", `history:page:${page - 1}`));
  if (start + 10 < items.length) controls.push(inlineButton("Вперёд ➡️", `history:page:${page + 1}`));
  if (controls.length) rows.push(controls);
  rows.push([inlineButton("В главное меню", "menu:main")]);
  await ctx.reply(text, { reply_markup: inlineKeyboard(rows) });
}

composer.callbackQuery("menu:history:page:1", async (ctx) => { await ctx.answerCallbackQuery(); await render(ctx, 1); });
composer.hears("Мои чаты", async (ctx) => { await render(ctx, 1); });
composer.callbackQuery(/^history:page:(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await render(ctx, Number(ctx.match[1])); });
composer.callbackQuery(/^history:open:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = stateOf(ctx); const conversation = state.conversations.find((c) => c.id === ctx.match[1] && !c.deleted);
  if (!conversation) return ctx.reply("Разговор уже удалён.");
  state.activeConversationId = conversation.id; state.flow = "chat";
  await ctx.reply(conversation.messages.length ? conversation.messages.map((m) => `${m.author === "user" ? "Вы" : "Ассистент"}: ${m.text}`).join("\n\n") : "В этом разговоре пока нет сообщений.", { reply_markup: inlineKeyboard([[inlineButton("⬅️ К истории", "menu:history:page:1")]]) });
});
composer.callbackQuery(/^history:delete:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const c = stateOf(ctx).conversations.find((x) => x.id === ctx.match[1]); if (c) c.deleted = true; await ctx.reply("Разговор удалён.", { reply_markup: inlineKeyboard([[inlineButton("К истории", "menu:history:page:1")]]) }); });
composer.callbackQuery(/^history:rename:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const state = stateOf(ctx); state.flow = "rename"; state.flowValue = ctx.match[1]; await ctx.reply("Как назвать этот разговор?", { reply_markup: { force_reply: true, input_field_placeholder: "Новое название" } }); });
composer.callbackQuery(/^history:export:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await sendConversationExport(ctx, stateOf(ctx).conversations.find((c) => c.id === ctx.match[1])); });
composer.on("message:text", async (ctx, next) => { const state = stateOf(ctx); if (state.flow !== "rename") return next(); const c = state.conversations.find((x) => x.id === state.flowValue && !x.deleted); if (c) c.title = ctx.message.text.trim().slice(0, 80) || c.title; state.flow = "idle"; await ctx.reply("Название обновлено.", { reply_markup: inlineKeyboard([[inlineButton("К истории", "menu:history:page:1")]]) }); });

export default composer;
