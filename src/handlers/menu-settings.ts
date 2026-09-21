import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { loadState, now, saveState } from "../state.js";
registerMainMenuItem({ label: "Настройки", data: "menu:settings", order: 40 });
const composer = new Composer<Ctx>();
const keyboard = inlineKeyboard([[inlineButton("30 дней", "settings:retention:30"), inlineButton("90 дней", "settings:retention:90"), inlineButton("365 дней", "settings:retention:365")], [inlineButton("Сменить язык", "profile:language"), inlineButton("Сжать ответы", "settings:compact")], [inlineButton("В главное меню", "menu:main")]]);
function text(s: Awaited<ReturnType<typeof loadState>>) { const p = s.profile; return `Настройки\n\nХранить историю: ${p.historyRetentionDays} дней\nКороткие ответы: ${p.compactReplies ? "включены" : "выключены"}`; }
async function show(ctx: Ctx) { const s = await loadState(ctx); await ctx.reply(text(s), { reply_markup: keyboard }); }
composer.callbackQuery("menu:settings", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx); });
composer.callbackQuery(/^settings:retention:(30|90|365)$/, async (ctx) => { await ctx.answerCallbackQuery(); const s = await loadState(ctx); const days = Number(ctx.match[1]) as 30 | 90 | 365; s.profile.historyRetentionDays = days; const cutoff = now() - days * 86400000; for (const c of s.conversations) { c.messages = c.messages.filter((m) => m.timestamp >= cutoff); if (!c.messages.length && c.updatedAt < cutoff) c.deleted = true; } await saveState(ctx, s); await ctx.reply(`История будет храниться ${ctx.match[1]} дней.`, { reply_markup: keyboard }); });
composer.callbackQuery("settings:compact", async (ctx) => { await ctx.answerCallbackQuery(); const s = await loadState(ctx); s.profile.compactReplies = !s.profile.compactReplies; await saveState(ctx, s); await ctx.reply(s.profile.compactReplies ? "Короткие ответы включены." : "Полные ответы включены.", { reply_markup: keyboard }); });
export default composer;
