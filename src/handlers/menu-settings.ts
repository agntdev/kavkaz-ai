import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { now, stateOf } from "../state.js";

registerMainMenuItem({ label: "⚙️ Settings", data: "menu:settings", order: 40 });
const composer = new Composer<Ctx>();
const keyboard = inlineKeyboard([
  [inlineButton("30 дней", "settings:retention:30"), inlineButton("90 дней", "settings:retention:90"), inlineButton("365 дней", "settings:retention:365")],
  [inlineButton("Сменить язык", "profile:language"), inlineButton("Сжать ответы", "settings:compact")],
  [inlineButton("⬅️ Back to menu", "menu:main")],
]);
function text(ctx: Ctx) { const p = stateOf(ctx).profile!; return `Toggle preferences: message language, history retention, compact/expanded replies\n\nХранить историю: ${p.historyRetentionDays} дней\nКороткие ответы: ${p.compactReplies ? "включены" : "выключены"}`; }
composer.callbackQuery("menu:settings", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("Toggle preferences: message language, history retention, compact/expanded replies", { reply_markup: keyboard }); await ctx.reply(text(ctx).split("\n\n")[1]); });
composer.callbackQuery(/^settings:retention:(30|90|365)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const state = stateOf(ctx);
  const days = Number(ctx.match[1]) as 30 | 90 | 365;
  state.profile!.historyRetentionDays = days;
  const cutoff = now() - days * 24 * 60 * 60 * 1000;
  for (const conversation of state.conversations) {
    conversation.messages = conversation.messages.filter((message) => message.timestamp >= cutoff);
    if (conversation.messages.length === 0 && conversation.lastActivityAt < cutoff) conversation.deleted = true;
  }
  await ctx.reply(`История будет храниться ${ctx.match[1]} дней.`, { reply_markup: keyboard });
});
composer.callbackQuery("settings:compact", async (ctx) => { await ctx.answerCallbackQuery(); const p = stateOf(ctx).profile!; p.compactReplies = !p.compactReplies; await ctx.reply(p.compactReplies ? "Короткие ответы включены." : "Полные ответы включены.", { reply_markup: keyboard }); });
export default composer;
