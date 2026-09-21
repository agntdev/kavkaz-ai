import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { stateOf } from "../state.js";
type OwnerCtx = Ctx & { env?: Record<string, unknown> };

registerMainMenuItem({ label: "🛠 Owner desk", data: "admin:open", order: 90 });
const composer = new Composer<Ctx>();

composer.callbackQuery("admin:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx as any))) return;
  const state = stateOf(ctx);
  await ctx.reply(`Панель владельца\nОтчётов: ${state.reports.length}\nУведомления: ${adminChatId(ctx as any) ? "включены" : "не настроены"}`, { reply_markup: inlineKeyboard([[inlineButton("Подтвердить отчёты", "admin:ack")], [inlineButton("⬅️ Back to menu", "menu:main")]]) });
});

composer.callbackQuery("admin:ack", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx as any))) return; await ctx.reply("Отчёты отмечены как просмотренные.", { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }); });

export default composer;
