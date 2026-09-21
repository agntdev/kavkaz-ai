import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { now, stateOf, type StoredReport } from "../state.js";
type OwnerCtx = Ctx & { env?: Record<string, unknown> };

registerMainMenuItem({ label: "📝 Report a problem", data: "menu:report", order: 50 });
const composer = new Composer<Ctx>();
const categories = inlineKeyboard([[inlineButton("Ошибка", "report:category:bug"), inlineButton("Идея", "report:category:idea")], [inlineButton("Другое", "report:category:other")], [inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.callbackQuery("menu:report", async (ctx) => { await ctx.answerCallbackQuery(); stateOf(ctx).flow = "report-category"; await ctx.reply("Open a short report form (multi-step) that notifies admin on submit", { reply_markup: categories }); });
composer.callbackQuery(/^report:category:(bug|idea|other)$/, async (ctx) => { await ctx.answerCallbackQuery(); const state = stateOf(ctx); state.flow = "report-description"; state.flowValue = ctx.match[1]; await ctx.reply("Коротко опишите проблему — без личных данных.", { reply_markup: { force_reply: true, input_field_placeholder: "Что случилось" } }); });
composer.on("message:text", async (ctx, next) => {
  const state = stateOf(ctx);
  if (state.flow !== "report-description") return next();
  const description = ctx.message.text.trim();
  if (description.length < 3) return ctx.reply("Опишите проблему чуть подробнее.", { reply_markup: { force_reply: true, input_field_placeholder: "Что случилось" } });
  const report: StoredReport = { id: `r${now()}-${state.reports.length}`, category: state.flowValue ?? "other", description: description.slice(0, 2000), submittedAt: now() };
  state.reports.push(report); state.flow = "idle";
  const owner = adminChatId(ctx as OwnerCtx);
  if (!owner) { await ctx.reply("Спасибо, записал сообщение. Владелец ещё не подключил уведомления.", { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) }); return; }
  try {
    await ctx.api.sendMessage(owner, `Новый отчёт\nКатегория: ${report.category}\nПользователь: ${ctx.from?.id ?? "неизвестно"}\nИмя: ${state.profile?.displayName ?? "не указано"}\nОписание: ${report.description}`);
    report.notifiedAdminAt = now();
    await ctx.reply("Спасибо — отправил отчёт владельцу. Мы разберёмся.", { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) });
  } catch { await ctx.reply("Отчёт сохранён, но уведомление владельцу не доставилось. Попробуйте позже."); }
});
export default composer;
